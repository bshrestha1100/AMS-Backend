const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false
    },
    role: {
        type: String,
        enum: ['admin', 'tenant', 'worker'],
        default: 'tenant'
    },
    phone: {
        type: String,
        required: function () { return this.role === 'tenant' || this.role === 'worker'; }
    },

    // Tenant-specific fields with historical data
    tenantInfo: {
        roomNumber: {
            type: String,
            required: function () { return this.role === 'tenant'; }
        },
        apartmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Apartment',
            required: function () { return this.role === 'tenant'; }
        },
        leaseStartDate: {
            type: Date,
            required: function () { return this.role === 'tenant'; }
        },
        leaseEndDate: {
            type: Date,
            required: function () { return this.role === 'tenant'; }
        },
        // NEW: Historical lease tracking
        leaseHistory: [{
            apartmentId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Apartment'
            },
            roomNumber: String,
            startDate: Date,
            endDate: Date,
            monthlyRent: Number,
            securityDeposit: Number,
            reasonForLeaving: String,
            totalDaysStayed: Number,
            totalMonthsStayed: Number
        }],
        currentAddress: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String
        },
        permanentAddress: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String
        },
        emergencyContact: {
            name: {
                type: String,
                required: function () { return this.role === 'tenant'; }
            },
            phone: {
                type: String,
                required: function () { return this.role === 'tenant'; }
            },
            relationship: {
                type: String,
                required: function () { return this.role === 'tenant'; }
            },
            email: String,
            address: String
        },
        securityDeposit: {
            type: Number,
            default: 0
        },
        monthlyRent: {
            type: Number,
            required: function () { return this.role === 'tenant'; }
        },
        // NEW: Lease status tracking
        leaseStatus: {
            type: String,
            enum: ['active', 'expired', 'terminated', 'upcoming'],
            default: 'active'
        },
        // NEW: Total stay calculation
        totalStayDuration: {
            totalDays: { type: Number, default: 0 },
            totalMonths: { type: Number, default: 0 },
            totalYears: { type: Number, default: 0 }
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        deletedAt: {
            type: Date
        }
    },

    // Worker-specific fields
    workerInfo: {
        employeeId: String,
        department: {
            type: String,
            default: 'Maintenance'
        },
        joinDate: Date,
        address: String
    },

    isActive: {
        type: Boolean,
        default: true
    },

    // NEW: Historical tracking
    isHistoricalRecord: {
        type: Boolean,
        default: false
    },

    resetPasswordToken: String,
    resetPasswordExpire: Date
}, {
    timestamps: true
});

// Method to calculate total stay duration
userSchema.methods.calculateStayDuration = function () {
    if (this.role === 'tenant' && this.tenantInfo.leaseStartDate && this.tenantInfo.leaseEndDate) {
        const startDate = new Date(this.tenantInfo.leaseStartDate);
        const endDate = new Date(this.tenantInfo.leaseEndDate);
        const timeDiff = endDate.getTime() - startDate.getTime();
        const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
        const totalMonths = Math.ceil(totalDays / 30);
        const totalYears = Math.floor(totalMonths / 12);

        this.tenantInfo.totalStayDuration = {
            totalDays,
            totalMonths,
            totalYears
        };

        return { totalDays, totalMonths, totalYears };
    }
    return null;
};

// Method to update lease status
userSchema.methods.updateLeaseStatus = function () {
    if (this.role === 'tenant' && this.tenantInfo.leaseEndDate) {
        const now = new Date();
        const endDate = new Date(this.tenantInfo.leaseEndDate);
        const startDate = new Date(this.tenantInfo.leaseStartDate);

        if (now < startDate) {
            this.tenantInfo.leaseStatus = 'upcoming';
        } else if (now > endDate) {
            this.tenantInfo.leaseStatus = 'expired';
            this.isHistoricalRecord = true;
        } else {
            this.tenantInfo.leaseStatus = 'active';
        }
    }
};

// Pre-save middleware to calculate duration and update status
userSchema.pre('save', async function (next) {
    // Hash password if modified
    if (this.isModified('password')) {
        if (!this.password.startsWith('$2a$') && !this.password.startsWith('$2b$') && !this.password.startsWith('$2y$')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }
    }

    // Calculate stay duration and update lease status for tenants
    if (this.role === 'tenant') {
        this.calculateStayDuration();
        this.updateLeaseStatus();
    }

    next();
});

// Instance method to check password
userSchema.methods.matchPassword = async function (enteredPassword) {
    try {
        const isMatch = await bcrypt.compare(enteredPassword, this.password);
        return isMatch;
    } catch (error) {
        console.error('Error comparing password:', error);
        return false;
    }
};

// Add query middleware to exclude deleted users by default
userSchema.pre(/^find/, function(next) {
    // Only exclude deleted users if not explicitly querying for them
    if (!this.getQuery().isDeleted) {
        this.find({ isDeleted: { $ne: true } });
    }
    next();
});

module.exports = mongoose.model('User', userSchema);

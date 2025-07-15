const mongoose = require('mongoose');

const utilityBillSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    apartmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Apartment',
        required: true
    },
    billNumber: {
        type: String,
        unique: true
        // Remove required: true - let the pre-save hook handle this
    },
    billingPeriod: {
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        }
    },
    utilities: [{
        utilityType: {
            type: String,
            enum: [
                'electricity',
                'water',
                'gas',
                'internet',
                'maintenance',
                'floor_heating', 
                'car_charging'
            ],
            required: true
        },
        previousReading: {
            type: Number,
            default: 0
        },
        currentReading: {
            type: Number,
            required: true
        },
        consumption: {
            type: Number,
            required: true
        },
        rate: {
            type: Number,
            required: true
        },
        amount: {
            type: Number,
            required: true
        }
    }],
    additionalCharges: [{
        description: String,
        amount: Number
    }],
    discounts: [{
        description: String,
        amount: Number
    }],
    subtotal: {
        type: Number,
        required: true
    },
    tax: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'generated', 'under_review', 'approved', 'sent', 'paid', 'overdue', 'cancelled'],
        default: 'draft'
    },
    dueDate: {
        type: Date,
        required: true
    },
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    generatedAt: Date,
    reviewedAt: Date,
    approvedAt: Date,
    sentAt: Date,
    paidAt: Date,
    paymentMethod: String,
    adminNotes: String,
    reviewNotes: String,
    emailSent: {
        type: Boolean,
        default: false
    },
    emailSentAt: Date,
    remindersSent: {
        type: Number,
        default: 0
    },
    lastReminderAt: Date
}, {
    timestamps: true
});

// Auto-generate bill number before saving
utilityBillSchema.pre('save', async function (next) {
    try {
        // Only generate billNumber if it's a new document and billNumber is not set
        if (this.isNew && !this.billNumber) {
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const prefix = `BILL-${year}${month}-`;

            // Find the highest existing bill number for this month
            const existingBills = await this.constructor.find({
                billNumber: { $regex: `^${prefix}` }
            }).sort({ billNumber: -1 }).limit(1);

            let nextNumber = 1;
            if (existingBills.length > 0) {
                const lastBillNumber = existingBills[0].billNumber;
                const lastNumber = parseInt(lastBillNumber.split('-')[2]);
                nextNumber = lastNumber + 1;
            }

            // Generate bill number with proper padding
            this.billNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;

            // Double-check for uniqueness (in case of concurrent requests)
            let attempts = 0;
            while (attempts < 10) {
                const existingBill = await this.constructor.findOne({ billNumber: this.billNumber });
                if (!existingBill) {
                    break; // Unique number found
                }
                nextNumber++;
                this.billNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;
                attempts++;
            }

            if (attempts >= 10) {
                throw new Error('Unable to generate unique bill number after 10 attempts');
            }
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Indexes for better performance
utilityBillSchema.index({ tenantId: 1, status: 1 });
utilityBillSchema.index({ dueDate: 1, status: 1 });
utilityBillSchema.index({ 'billingPeriod.startDate': 1, 'billingPeriod.endDate': 1 });

module.exports = mongoose.model('UtilityBill', utilityBillSchema);

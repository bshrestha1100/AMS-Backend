const mongoose = require('mongoose');

const beverageCartSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        beverageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Beverage',
            required: true
        },
        beverageName: String,
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        unitPrice: {
            type: Number,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    totalAmount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'ordered', 'billed'],
        default: 'active'
    },
    billingMonth: String,
    billingYear: Number,
    orderedAt: Date,
    billedAt: Date
}, {
    timestamps: true
});

// Calculate total amount before saving
beverageCartSchema.pre('save', function (next) {
    this.totalAmount = this.items.reduce((total, item) => total + item.totalPrice, 0);
    next();
});

module.exports = mongoose.model('BeverageCart', beverageCartSchema);

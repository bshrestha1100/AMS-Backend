const mongoose = require('mongoose');

const beverageConsumptionSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    beverageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Beverage',
        required: true
    },
    reservationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RooftopReservation'
    },
    quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
        type: Number,
        required: true,
        min: [0, 'Unit price cannot be negative']
    },
    totalAmount: {
        type: Number,
        required: true,
        min: [0, 'Total amount cannot be negative']
    },
    consumptionDate: {
        type: Date,
        default: Date.now
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'cancelled'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'online', 'account'],
        default: 'account'
    },
    notes: String
}, {
    timestamps: true
});

// Indexes for better query performance
beverageConsumptionSchema.index({ tenantId: 1, consumptionDate: -1 });
beverageConsumptionSchema.index({ beverageId: 1, consumptionDate: -1 });
beverageConsumptionSchema.index({ consumptionDate: -1 });
beverageConsumptionSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('BeverageConsumption', beverageConsumptionSchema);

const mongoose = require('mongoose');

const rooftopReservationSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reservationDate: {
        type: Date,
        required: true
    },
    timeSlot: {
        type: String,
        required: true,
        enum: ['morning', 'afternoon', 'evening', 'night', 'full-day']
    },
    timeSlotDetails: {
        startTime: String,
        endTime: String
    },
    numberOfGuests: {
        type: Number,
        required: true,
        min: 1,
        max: 20
    },
    purpose: {
        type: String,
        maxlength: 500
    },
    specialRequests: {
        type: String,
        maxlength: 500
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    },
    adminNotes: String,
    roomNumber: String,
    contactPhone: String
}, {
    timestamps: true
});

// Index for better query performance
rooftopReservationSchema.index({ tenantId: 1, reservationDate: -1 });
rooftopReservationSchema.index({ reservationDate: 1, timeSlot: 1 });

module.exports = mongoose.model('RooftopReservation', rooftopReservationSchema);

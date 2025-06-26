const mongoose = require('mongoose');

const apartmentSchema = new mongoose.Schema({
    unitNumber: {
        type: String,
        required: true,
        unique: true
    },
    building: {
        type: String,
        required: true
    },
    floor: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['1BHK', '2BHK', '3BHK', 'Penthouse'],
        required: true
    },
    bedrooms: {
        type: Number
    },
    bathrooms: {
        type: Number
    },
    area: {
        type: Number, // in square feet
        required: true
    },
    rent: {
        type: Number,
        required: true
    },
    deposit: {
        type: Number
    },
    isOccupied: {
        type: Boolean,
        default: false
    },
    currentTenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    occupiedDate: {
        type: Date
    },
    lastVacatedDate: {
        type: Date
    },
    amenities: [String],
    description: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Apartment', apartmentSchema);

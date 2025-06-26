const express = require('express');
const Apartment = require('../models/Apartment');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all apartments
router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        const apartments = await Apartment.find({})
            .populate('currentTenant', 'name email phone')
            .sort({ building: 1, floor: 1, unitNumber: 1 });

        res.json({
            success: true,
            count: apartments.length,
            data: apartments
        });
    } catch (error) {
        console.error('Error fetching apartments:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get available apartments
router.get('/available', protect, authorize('admin'), async (req, res) => {
    try {
        const apartments = await Apartment.find({
            isOccupied: false
        }).sort({ building: 1, floor: 1, unitNumber: 1 });

        res.json({
            success: true,
            count: apartments.length,
            data: apartments
        });
    } catch (error) {
        console.error('Error fetching available apartments:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get available apartments list
router.get('/available/list', protect, async (req, res) => {
    try {
        const apartments = await Apartment.find({ isOccupied: false }).sort('unitNumber');

        res.json({
            success: true,
            count: apartments.length,
            data: apartments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Create apartment (admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const apartment = await Apartment.create(req.body);

        res.status(201).json({
            success: true,
            data: apartment,
            message: 'Apartment created successfully'
        });
    } catch (error) {
        console.error('Error creating apartment:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get single apartment
router.get('/:id', protect, async (req, res) => {
    try {
        const apartment = await Apartment.findById(req.params.id)
            .populate('currentTenant', 'name email phone');

        if (!apartment) {
            return res.status(404).json({
                success: false,
                message: 'Apartment not found'
            });
        }

        res.json({
            success: true,
            data: apartment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Update apartment (admin only)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const apartment = await Apartment.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!apartment) {
            return res.status(404).json({
                success: false,
                message: 'Apartment not found'
            });
        }

        res.json({
            success: true,
            data: apartment,
            message: 'Apartment updated successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Delete apartment (admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const apartment = await Apartment.findById(req.params.id);

        if (!apartment) {
            return res.status(404).json({
                success: false,
                message: 'Apartment not found'
            });
        }

        // Check if apartment is occupied before deleting
        if (apartment.isOccupied) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete occupied apartment. Please move out tenant first.'
            });
        }

        await Apartment.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            data: {},
            message: 'Apartment deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;

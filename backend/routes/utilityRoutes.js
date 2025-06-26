const express = require('express');
const UtilityBill = require('../models/UtilityBill');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all utility bills
router.get('/', protect, async (req, res) => {
    try {
        let filter = {};

        // If tenant, only show their bills
        if (req.user.role === 'tenant') {
            filter.tenantId = req.user._id;
        }

        const bills = await UtilityBill.find(filter)
            .populate('apartmentId', 'unitNumber')
            .populate('tenantId', 'name')
            .sort('-createdAt');

        res.json({
            success: true,
            count: bills.length,
            data: bills
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Create utility bill (admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const billData = {
            ...req.body,
            generatedBy: req.user._id
        };

        const bill = await UtilityBill.create(billData);

        res.status(201).json({
            success: true,
            data: bill
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;

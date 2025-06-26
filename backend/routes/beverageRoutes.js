const express = require('express');
const Beverage = require('../models/Beverage');
const BeverageConsumption = require('../models/BeverageConsumption');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all beverages
router.get('/', protect, async (req, res) => {
    try {
        const beverages = await Beverage.find().sort('name');

        res.json({
            success: true,
            count: beverages.length,
            data: beverages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Create beverage (admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const beverage = await Beverage.create(req.body);

        res.status(201).json({
            success: true,
            data: beverage
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Update beverage (admin only)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const beverage = await Beverage.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!beverage) {
            return res.status(404).json({
                success: false,
                message: 'Beverage not found'
            });
        }

        res.json({
            success: true,
            data: beverage
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Delete beverage (admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const beverage = await Beverage.findByIdAndDelete(req.params.id);

        if (!beverage) {
            return res.status(404).json({
                success: false,
                message: 'Beverage not found'
            });
        }

        res.json({
            success: true,
            data: {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Aggregate beverage consumption stats (admin only)
router.get('/stats', protect, authorize('admin'), async (req, res) => {
    try {
        // You can add filters (e.g. by date, tenant) as query params if needed
        const stats = await BeverageConsumption.aggregate([
            {
                $group: {
                    _id: null,
                    totalQuantity: { $sum: '$quantity' },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);
        res.json({
            success: true,
            data: stats[0] || { totalQuantity: 0, totalAmount: 0 }
        });
    } catch (err) {
        console.error('Error fetching beverage consumption stats:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/beverages/consumption/history
// Get beverage consumption history for logged-in tenant with beverage names
router.get('/consumption/history', protect, async (req, res) => {
  try {
    const tenantId = req.user._id;

    const records = await BeverageConsumption.find({ tenantId })
      .populate('beverageId', 'name')  // Populate only the 'name' field
      .sort({ consumptionDate: -1 });  // Sort by most recent consumption

    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error('Error fetching beverage consumption history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
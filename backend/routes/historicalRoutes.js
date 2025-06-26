const express = require('express');
const HistoricalDataService = require('../services/historicalDataService');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Get tenant complete history (admin only)
router.get('/tenant/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const history = await HistoricalDataService.getTenantHistory(req.params.id);

        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get all historical tenants (admin only)
router.get('/tenants', protect, authorize('admin'), async (req, res) => {
    try {
        const historicalTenants = await HistoricalDataService.getHistoricalTenants();

        res.json({
            success: true,
            count: historicalTenants.length,
            data: historicalTenants
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Archive tenant (admin only)
router.post('/tenant/:id/archive', protect, authorize('admin'), async (req, res) => {
    try {
        const { reasonForLeaving } = req.body;
        const archivedTenant = await HistoricalDataService.archiveTenant(req.params.id, reasonForLeaving);

        res.json({
            success: true,
            data: archivedTenant,
            message: 'Tenant archived successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Update all lease statuses (admin only)
router.post('/update-statuses', protect, authorize('admin'), async (req, res) => {
    try {
        const result = await HistoricalDataService.updateLeaseStatuses();

        res.json({
            success: true,
            data: result,
            message: 'Lease statuses updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;

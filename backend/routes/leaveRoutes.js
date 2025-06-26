const express = require('express');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// ===== WORKER ROUTES =====

// Submit leave request (worker only)
router.post('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'worker') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Worker role required.'
            });
        }

        const leaveData = {
            ...req.body,
            workerId: req.user._id
        };

        const leaveRequest = await LeaveRequest.create(leaveData);

        const populatedRequest = await LeaveRequest.findById(leaveRequest._id)
            .populate('workerId', 'name email');

        res.status(201).json({
            success: true,
            data: populatedRequest,
            message: 'Leave request submitted successfully'
        });
    } catch (error) {
        console.error('Error creating leave request:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get worker's leave requests
router.get('/my-requests', protect, async (req, res) => {
    try {
        if (req.user.role !== 'worker') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Worker role required.'
            });
        }

        const requests = await LeaveRequest.find({ workerId: req.user._id })
            .populate('reviewedBy', 'name')
            .sort('-createdAt');

        res.json({
            success: true,
            count: requests.length,
            data: requests
        });
    } catch (error) {
        console.error('Error fetching worker leave requests:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ===== ADMIN ROUTES =====

// Get all leave requests (admin only)
router.get('/admin/all', protect, authorize('admin'), async (req, res) => {
    try {
        const { status, workerId } = req.query;

        let query = {};
        if (status && status !== 'all') query.status = status;
        if (workerId && workerId !== 'all') query.workerId = workerId;

        const requests = await LeaveRequest.find(query)
            .populate('workerId', 'name email phone workerInfo.department')
            .populate('reviewedBy', 'name email')
            .sort('-createdAt');

        res.json({
            success: true,
            count: requests.length,
            data: requests
        });
    } catch (error) {
        console.error('Error fetching all leave requests:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Review leave request (admin only)
router.patch('/:id/review', protect, authorize('admin'), async (req, res) => {
    try {
        const { status, reviewNotes } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be either approved or rejected'
            });
        }

        const request = await LeaveRequest.findByIdAndUpdate(
            req.params.id,
            {
                status,
                reviewNotes,
                reviewedBy: req.user._id,
                reviewedAt: new Date()
            },
            { new: true }
        )
            .populate('workerId', 'name email phone')
            .populate('reviewedBy', 'name email');

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Leave request not found'
            });
        }

        res.json({
            success: true,
            data: request,
            message: `Leave request ${status} successfully`
        });
    } catch (error) {
        console.error('Error reviewing leave request:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get leave request statistics (admin only)
router.get('/admin/stats', protect, authorize('admin'), async (req, res) => {
    try {
        const stats = {
            total: await LeaveRequest.countDocuments(),
            pending: await LeaveRequest.countDocuments({ status: 'pending' }),
            approved: await LeaveRequest.countDocuments({ status: 'approved' }),
            rejected: await LeaveRequest.countDocuments({ status: 'rejected' })
        };

        // Get this month's stats
        const thisMonth = new Date();
        const startOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);

        const monthlyStats = {
            thisMonth: await LeaveRequest.countDocuments({
                createdAt: { $gte: startOfMonth }
            }),
            pendingThisMonth: await LeaveRequest.countDocuments({
                status: 'pending',
                createdAt: { $gte: startOfMonth }
            })
        };

        res.json({
            success: true,
            data: { ...stats, ...monthlyStats }
        });
    } catch (error) {
        console.error('Error fetching leave stats:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;

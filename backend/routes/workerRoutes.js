const express = require('express');
const User = require('../models/User');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const LeaveRequest = require('../models/LeaveRequest');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get worker dashboard data
router.get('/dashboard', protect, async (req, res) => {
    try {
        if (req.user.role !== 'worker') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Worker role required.'
            });
        }

        // Get maintenance statistics
        const maintenanceStats = {
            total: await MaintenanceRequest.countDocuments({ assignedWorkerId: req.user._id }),
            pending: await MaintenanceRequest.countDocuments({
                assignedWorkerId: req.user._id,
                status: 'Assigned'
            }),
            inProgress: await MaintenanceRequest.countDocuments({
                assignedWorkerId: req.user._id,
                status: 'In Progress'
            }),
            completed: await MaintenanceRequest.countDocuments({
                assignedWorkerId: req.user._id,
                status: 'Completed'
            })
        };

        // Get recent maintenance requests
        const recentMaintenance = await MaintenanceRequest.find({
            assignedWorkerId: req.user._id
        })
            .populate('tenantId', 'name tenantInfo.roomNumber')
            .populate('apartmentId', 'unitNumber building')
            .sort('-assignedDate')
            .limit(5);

        // Get leave statistics
        const leaveStats = {
            total: await LeaveRequest.countDocuments({ workerId: req.user._id }),
            pending: await LeaveRequest.countDocuments({
                workerId: req.user._id,
                status: 'pending'
            }),
            approved: await LeaveRequest.countDocuments({
                workerId: req.user._id,
                status: 'approved'
            }),
            rejected: await LeaveRequest.countDocuments({
                workerId: req.user._id,
                status: 'rejected'
            })
        };

        // Get recent leave requests
        const recentLeaves = await LeaveRequest.find({
            workerId: req.user._id
        })
            .sort('-createdAt')
            .limit(5);

        // Calculate this month's stats
        const thisMonth = new Date();
        const startOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);

        const monthlyStats = {
            maintenanceCompleted: await MaintenanceRequest.countDocuments({
                assignedWorkerId: req.user._id,
                status: 'Completed',
                completedDate: { $gte: startOfMonth }
            }),
            averageCompletionTime: await MaintenanceRequest.aggregate([
                {
                    $match: {
                        assignedWorkerId: req.user._id,
                        status: 'Completed',
                        startedDate: { $exists: true },
                        completedDate: { $exists: true }
                    }
                },
                {
                    $project: {
                        completionTime: {
                            $divide: [
                                { $subtract: ['$completedDate', '$startedDate'] },
                                1000 * 60 * 60 // Convert to hours
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgTime: { $avg: '$completionTime' }
                    }
                }
            ])
        };

        res.json({
            success: true,
            data: {
                maintenanceStats,
                leaveStats,
                recentMaintenance,
                recentLeaves,
                monthlyStats: {
                    ...monthlyStats,
                    averageCompletionTime: monthlyStats.averageCompletionTime?.[0]?.avgTime || 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching worker dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;

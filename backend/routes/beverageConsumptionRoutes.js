const express = require('express');
const BeverageConsumption = require('../models/BeverageConsumption');
const Beverage = require('../models/Beverage');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// ===== ADMIN ROUTES =====

// Get all beverage consumption records (admin only)
router.get('/admin/all', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            startDate,
            endDate,
            tenantId,
            beverageId,
            paymentStatus,
            category,
            page = 1,
            limit = 50
        } = req.query;

        let query = {};

        // Date range filter
        if (startDate || endDate) {
            query.consumptionDate = {};
            if (startDate) query.consumptionDate.$gte = new Date(startDate);
            if (endDate) query.consumptionDate.$lte = new Date(endDate);
        }

        // Other filters
        if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
        if (beverageId && beverageId !== 'all') query.beverageId = beverageId;
        if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;

        // Build aggregation pipeline
        let pipeline = [
            { $match: query },
            {
                $lookup: {
                    from: 'users',
                    localField: 'tenantId',
                    foreignField: '_id',
                    as: 'tenant'
                }
            },
            {
                $lookup: {
                    from: 'beverages',
                    localField: 'beverageId',
                    foreignField: '_id',
                    as: 'beverage'
                }
            },
            {
                $unwind: '$tenant'
            },
            {
                $unwind: '$beverage'
            }
        ];

        // Category filter (applied after lookup)
        if (category && category !== 'all') {
            pipeline.push({
                $match: { 'beverage.category': category }
            });
        }

        // Sort by consumption date (newest first)
        pipeline.push({ $sort: { consumptionDate: -1 } });

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: parseInt(limit) });

        const consumptions = await BeverageConsumption.aggregate(pipeline);

        // Get total count for pagination
        const totalPipeline = [...pipeline.slice(0, -2)]; // Remove skip and limit
        totalPipeline.push({ $count: 'total' });
        const totalResult = await BeverageConsumption.aggregate(totalPipeline);
        const total = totalResult[0]?.total || 0;

        res.json({
            success: true,
            count: consumptions.length,
            total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            data: consumptions
        });
    } catch (error) {
        console.error('Error fetching beverage consumption:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

router.get('/admin/monthly-trends', protect, authorize('admin'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter.consumptionDate = {};
            if (startDate) dateFilter.consumptionDate.$gte = new Date(startDate);
            if (endDate) dateFilter.consumptionDate.$lte = new Date(endDate);
        }

        const monthlyTrends = await BeverageConsumption.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: {
                        year: { $year: '$consumptionDate' },
                        month: { $month: '$consumptionDate' }
                    },
                    totalQuantity: { $sum: '$quantity' },
                    totalRevenue: { $sum: '$totalAmount' },
                    orderCount: { $sum: 1 },
                    firstConsumption: { $min: '$consumptionDate' },
                    lastConsumption: { $max: '$consumptionDate' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            {
                $project: {
                    month: {
                        $let: {
                            vars: {
                                monthNames: ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                            },
                            in: {
                                $concat: [
                                    { $arrayElemAt: ['$$monthNames', '$_id.month'] },
                                    ' ',
                                    { $toString: '$_id.year' }
                                ]
                            }
                        }
                    },
                    dateRange: {
                        $let: {
                            vars: {
                                daysInMonth: {
                                    $switch: {
                                        branches: [
                                            { case: { $in: ['$_id.month', [1, 3, 5, 7, 8, 10, 12]] }, then: 31 },
                                            { case: { $in: ['$_id.month', [4, 6, 9, 11]] }, then: 30 },
                                            { case: { $eq: ['$_id.month', 2] }, then: 28 }
                                        ],
                                        default: 30
                                    }
                                },
                                firstDay: { $dayOfMonth: '$firstConsumption' },
                                lastDay: { $dayOfMonth: '$lastConsumption' }
                            },
                            in: {
                                $concat: [
                                    { $toString: '$$firstDay' },
                                    ' - ',
                                    {
                                        $toString: {
                                            $cond: [
                                                { $gt: ['$$lastDay', '$$daysInMonth'] },
                                                '$$daysInMonth',
                                                '$$lastDay'
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    },
                    totalQuantity: 1,
                    totalRevenue: 1,
                    orderCount: 1
                }
            }
        ]);

        res.json({
            success: true,
            data: monthlyTrends
        });
    } catch (error) {
        console.error('Error fetching monthly trends:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Add this new endpoint for daily consumption within a month
router.get('/admin/daily-consumption', protect, authorize('admin'), async (req, res) => {
    try {
        const { month, year } = req.query;

        // Default to current month/year if not provided
        const currentDate = new Date();
        const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const targetYear = year ? parseInt(year) : currentDate.getFullYear();

        // Create date range for the specific month
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0); // Last day of month

        const dailyConsumption = await BeverageConsumption.aggregate([
            {
                $match: {
                    consumptionDate: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: { $dayOfMonth: '$consumptionDate' },
                    beverageCount: { $sum: '$quantity' },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        // Create array for all days (1-30/31) with zero values
        const daysInMonth = endDate.getDate();
        const dailyData = Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const dayData = dailyConsumption.find(item => item._id === day);
            return {
                day: day,
                beverageCount: dayData ? dayData.beverageCount : 0,
                orderCount: dayData ? dayData.orderCount : 0
            };
        });

        res.json({
            success: true,
            data: {
                month: targetMonth,
                year: targetYear,
                daysInMonth: daysInMonth,
                dailyData: dailyData
            }
        });
    } catch (error) {
        console.error('Error fetching daily consumption:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});


// Get beverage consumption statistics (admin only)
router.get('/admin/stats', protect, authorize('admin'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter.consumptionDate = {};
            if (startDate) dateFilter.consumptionDate.$gte = new Date(startDate);
            if (endDate) dateFilter.consumptionDate.$lte = new Date(endDate);
        }

        // Overall statistics
        const overallStats = await BeverageConsumption.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: null,
                    totalConsumptions: { $sum: 1 },
                    totalQuantity: { $sum: '$quantity' },
                    totalRevenue: { $sum: '$totalAmount' },
                    avgOrderValue: { $avg: '$totalAmount' }
                }
            }
        ]);

        // Category-wise statistics
        const categoryStats = await BeverageConsumption.aggregate([
            { $match: dateFilter },
            {
                $lookup: {
                    from: 'beverages',
                    localField: 'beverageId',
                    foreignField: '_id',
                    as: 'beverage'
                }
            },
            { $unwind: '$beverage' },
            {
                $group: {
                    _id: '$beverage.category',
                    totalQuantity: { $sum: '$quantity' },
                    totalRevenue: { $sum: '$totalAmount' },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        // Top beverages
        const topBeverages = await BeverageConsumption.aggregate([
            { $match: dateFilter },
            {
                $lookup: {
                    from: 'beverages',
                    localField: 'beverageId',
                    foreignField: '_id',
                    as: 'beverage'
                }
            },
            { $unwind: '$beverage' },
            {
                $group: {
                    _id: '$beverageId',
                    beverageName: { $first: '$beverage.name' },
                    category: { $first: '$beverage.category' },
                    totalQuantity: { $sum: '$quantity' },
                    totalRevenue: { $sum: '$totalAmount' },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 }
        ]);

        // Payment status breakdown
        const paymentStats = await BeverageConsumption.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: '$paymentStatus',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$totalAmount' }
                }
            }
        ]);

        // Daily consumption trend (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const dailyTrend = await BeverageConsumption.aggregate([
            {
                $match: {
                    consumptionDate: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$consumptionDate' }
                    },
                    totalQuantity: { $sum: '$quantity' },
                    totalRevenue: { $sum: '$totalAmount' },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            success: true,
            data: {
                overall: overallStats[0] || {
                    totalConsumptions: 0,
                    totalQuantity: 0,
                    totalRevenue: 0,
                    avgOrderValue: 0
                },
                categoryStats,
                topBeverages,
                paymentStats,
                dailyTrend
            }
        });
    } catch (error) {
        console.error('Error fetching consumption stats:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});


// Update payment status when utility bill is paid
router.put('/admin/mark-as-paid/:utilityBillId', protect, authorize('admin'), async (req, res) => {
    try {
        const { utilityBillId } = req.params;

        await BeverageConsumption.updateMany(
            { utilityBillId: utilityBillId },
            { paymentStatus: 'paid' }
        );

        res.json({
            success: true,
            message: 'Beverage consumptions marked as paid'
        });
    } catch (error) {
        console.error('Error updating beverage payment status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get consumption summary by tenant (admin only)
router.get('/admin/tenant-summary', protect, authorize('admin'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter.consumptionDate = {};
            if (startDate) dateFilter.consumptionDate.$gte = new Date(startDate);
            if (endDate) dateFilter.consumptionDate.$lte = new Date(endDate);
        }

        const tenantSummary = await BeverageConsumption.aggregate([
            { $match: dateFilter },
            {
                $lookup: {
                    from: 'users',
                    localField: 'tenantId',
                    foreignField: '_id',
                    as: 'tenant'
                }
            },
            { $unwind: '$tenant' },
            {
                $group: {
                    _id: '$tenantId',
                    tenantName: { $first: '$tenant.name' },
                    tenantEmail: { $first: '$tenant.email' },
                    roomNumber: { $first: '$tenant.tenantInfo.roomNumber' },
                    totalOrders: { $sum: 1 },
                    totalQuantity: { $sum: '$quantity' },
                    totalAmount: { $sum: '$totalAmount' },
                    pendingAmount: {
                        $sum: {
                            $cond: [{ $eq: ['$paymentStatus', 'pending'] }, '$totalAmount', 0]
                        }
                    },
                    lastOrder: { $max: '$consumptionDate' }
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);

        res.json({
            success: true,
            data: tenantSummary
        });
    } catch (error) {
        console.error('Error fetching tenant summary:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ===== TENANT ROUTES =====

// Get tenant's own consumption history
router.get('/my-consumption', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const consumptions = await BeverageConsumption.find({ tenantId: req.user._id })
            .populate('beverageId', 'name category price')
            .sort('-consumptionDate')
            .skip(skip)
            .limit(parseInt(limit));

        const total = await BeverageConsumption.countDocuments({ tenantId: req.user._id });

        res.json({
            success: true,
            count: consumptions.length,
            total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            data: consumptions
        });
    } catch (error) {
        console.error('Error fetching tenant consumption:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;

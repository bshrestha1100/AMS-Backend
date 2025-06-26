const express = require('express');
const UtilityBill = require('../models/UtilityBill');
const User = require('../models/User');
const Apartment = require('../models/Apartment');
const emailService = require('../services/emailService');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Create utility bill and send email
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const { tenantId, billType, amount, dueDate, billMonth } = req.body;

        // Get tenant details
        const tenant = await User.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        try {
            await emailService.sendUtilityBillEmail({
                name: tenant.name,
                email: tenant.email,
                billType: 'Utility Bill',
                amount: amount,        // Use the amount from req.body
                dueDate: dueDate,      // Use the dueDate from req.body
                billMonth: billMonth
            });
        } catch (emailError) {
            console.error('Failed to send utility bill email:', emailError);
        }

        res.status(201).json({
            success: true,
            message: 'Utility bill created and email sent successfully'
        });

    } catch (error) {
        console.error('Error creating utility bill:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
// ===== ADMIN ROUTES =====

// Get all utility bills (admin only)
router.get('/admin/all', protect, authorize('admin'), async (req, res) => {
    try {
        const { status, tenantId, startDate, endDate, page = 1, limit = 50 } = req.query;

        let query = {};

        // Date range filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Other filters
        if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
        if (status && status !== 'all') query.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const bills = await UtilityBill.find(query)
            .populate('tenantId', 'name email tenantInfo.roomNumber')
            .populate('apartmentId', 'unitNumber building')
            .populate('generatedBy', 'name')
            .populate('reviewedBy', 'name')
            .populate('approvedBy', 'name')
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        const total = await UtilityBill.countDocuments(query);

        res.json({
            success: true,
            count: bills.length,
            total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            data: bills
        });
    } catch (error) {
        console.error('Error fetching utility bills:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Simple create and send bill in one step (admin only)
// Enhanced create and send bill with beverage consumption integration
router.post('/admin/create-and-send', protect, authorize('admin'), async (req, res) => {
    try {
        // Get tenant data to extract apartmentId
        const tenant = await User.findById(req.body.tenantId).populate('tenantInfo');

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        const billData = {
            ...req.body,
            tenantId: tenant._id,
            apartmentId: tenant.tenantInfo?.apartmentId || tenant.apartmentId,
            generatedBy: req.user._id,
            status: 'sent',
            sentAt: new Date(),
            emailSent: true,
            emailSentAt: new Date()
        };

        // Calculate utilities total
        let subtotal = 0;
        billData.utilities.forEach(utility => {
            utility.consumption = utility.currentReading - (utility.previousReading || 0);
            utility.amount = utility.consumption * utility.rate;
            subtotal += utility.amount;
        });

        // Fetch pending beverage consumption for this billing period
        const BeverageConsumption = require('../models/BeverageConsumption');
        const pendingBeverages = await BeverageConsumption.find({
            tenantId: tenant._id,
            paymentStatus: 'pending',
            includedInBill: false,
            consumptionDate: {
                $gte: new Date(billData.billingPeriod.startDate),
                $lte: new Date(billData.billingPeriod.endDate)
            }
        }).populate('beverageId', 'name category price');

        // Add beverage consumption to bill
        let beverageTotal = 0;
        const beverageItems = [];

        if (pendingBeverages.length > 0) {
            pendingBeverages.forEach(beverage => {
                beverageTotal += beverage.totalAmount;
                beverageItems.push({
                    beverageConsumptionId: beverage._id,
                    beverageName: beverage.beverageId.name,
                    quantity: beverage.quantity,
                    unitPrice: beverage.unitPrice,
                    amount: beverage.totalAmount,
                    consumptionDate: beverage.consumptionDate
                });
            });
        }

        // Add beverage consumption to bill data
        billData.beverageConsumption = {
            totalAmount: beverageTotal,
            items: beverageItems
        };

        // Calculate additional charges
        if (billData.additionalCharges) {
            billData.additionalCharges.forEach(charge => {
                subtotal += charge.amount;
            });
        }

        // Calculate discounts
        if (billData.discounts) {
            billData.discounts.forEach(discount => {
                subtotal -= discount.amount;
            });
        }

        // Add beverage total to subtotal
        subtotal += beverageTotal;

        billData.subtotal = subtotal;
        billData.totalAmount = subtotal + (billData.tax || 0);

        // Create the bill
        const bill = await UtilityBill.create(billData);

        // Link beverage consumption records to this bill
        if (pendingBeverages.length > 0) {
            const beverageIds = pendingBeverages.map(b => b._id);
            await BeverageConsumption.updateMany(
                { _id: { $in: beverageIds } },
                {
                    utilityBillId: bill._id,
                    billingPeriod: {
                        startDate: billData.billingPeriod.startDate,
                        endDate: billData.billingPeriod.endDate
                    },
                    includedInBill: true
                }
            );
        }

        // Get populated bill data
        const populatedBill = await UtilityBill.findById(bill._id)
            .populate('tenantId', 'name email')
            .populate('apartmentId', 'unitNumber building');

        // Send email to tenant
        try {
            await emailService.sendUtilityBillEmail({
                name: populatedBill.tenantId.name,
                email: populatedBill.tenantId.email,
                billType: 'Utility Bill',
                amount: populatedBill.totalAmount,
                dueDate: populatedBill.dueDate,
                billMonth: new Date(populatedBill.billingPeriod.startDate).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                })
            });
            console.log(`Bill ${bill.billNumber} sent to ${populatedBill.tenantId.email}`);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
        }

        res.status(201).json({
            success: true,
            data: populatedBill,
            message: `Utility bill created and sent successfully. Included ${beverageItems.length} beverage consumption records.`
        });
    } catch (error) {
        console.error('Error creating and sending bill:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});


// Also update the regular create route
router.post('/admin/create', protect, authorize('admin'), async (req, res) => {
    try {
        // Get tenant data to extract apartmentId
        const tenant = await User.findById(req.body.tenantId).populate('tenantInfo');

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        const billData = {
            ...req.body,
            tenantId: tenant._id,
            apartmentId: tenant.tenantInfo?.apartmentId || tenant.apartmentId, // Add this line
            generatedBy: req.user._id,
            status: 'draft'
        };

        // Calculate totals
        let subtotal = 0;
        billData.utilities.forEach(utility => {
            utility.consumption = utility.currentReading - (utility.previousReading || 0);
            utility.amount = utility.consumption * utility.rate;
            subtotal += utility.amount;
        });

        if (billData.additionalCharges) {
            billData.additionalCharges.forEach(charge => {
                subtotal += charge.amount;
            });
        }

        if (billData.discounts) {
            billData.discounts.forEach(discount => {
                subtotal -= discount.amount;
            });
        }

        billData.subtotal = subtotal;
        billData.totalAmount = subtotal + (billData.tax || 0);

        const bill = await UtilityBill.create(billData);

        const populatedBill = await UtilityBill.findById(bill._id)
            .populate('tenantId', 'name email')
            .populate('apartmentId', 'unitNumber building');

        res.status(201).json({
            success: true,
            data: populatedBill,
            message: 'Utility bill created successfully'
        });
    } catch (error) {
        console.error('Error creating utility bill:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Update utility bill (admin only)
router.put('/admin/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const billId = req.params.id;
        const updateData = { ...req.body };

        // Calculate totals if utilities are being updated
        if (updateData.utilities) {
            let subtotal = 0;
            updateData.utilities.forEach(utility => {
                utility.consumption = utility.currentReading - (utility.previousReading || 0);
                utility.amount = utility.consumption * utility.rate;
                subtotal += utility.amount;
            });

            if (updateData.additionalCharges) {
                updateData.additionalCharges.forEach(charge => {
                    subtotal += charge.amount;
                });
            }

            if (updateData.discounts) {
                updateData.discounts.forEach(discount => {
                    subtotal -= discount.amount;
                });
            }

            updateData.subtotal = subtotal;
            updateData.totalAmount = subtotal + (updateData.tax || 0);
        }

        const bill = await UtilityBill.findByIdAndUpdate(
            billId,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('tenantId', 'name email')
            .populate('apartmentId', 'unitNumber building');

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Utility bill not found'
            });
        }

        res.json({
            success: true,
            data: bill,
            message: 'Utility bill updated successfully'
        });
    } catch (error) {
        console.error('Error updating utility bill:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Delete utility bill (admin only)
router.delete('/admin/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const billId = req.params.id;

        const bill = await UtilityBill.findById(billId);

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Utility bill not found'
            });
        }

        await UtilityBill.findByIdAndDelete(billId);

        res.json({
            success: true,
            message: `Utility bill ${bill.billNumber} deleted successfully`
        });
    } catch (error) {
        console.error('Error deleting utility bill:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Generate bills for review (admin only)
router.post('/admin/generate-batch', protect, authorize('admin'), async (req, res) => {
    try {
        const { billIds } = req.body;

        const updatedBills = await UtilityBill.updateMany(
            { _id: { $in: billIds }, status: 'draft' },
            {
                status: 'under_review',
                generatedAt: new Date()
            }
        );

        res.json({
            success: true,
            message: `${updatedBills.modifiedCount} bills sent for review`,
            modifiedCount: updatedBills.modifiedCount
        });
    } catch (error) {
        console.error('Error generating bills:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Review and approve/reject bills (admin only)
router.patch('/admin/:id/review', protect, authorize('admin'), async (req, res) => {
    try {
        const { action, reviewNotes } = req.body; // action: 'approve' or 'reject'

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Action must be either approve or reject'
            });
        }

        const updateData = {
            reviewedBy: req.user._id,
            reviewedAt: new Date(),
            reviewNotes,
            status: action === 'approve' ? 'approved' : 'draft'
        };

        if (action === 'approve') {
            updateData.approvedBy = req.user._id;
            updateData.approvedAt = new Date();
        }

        const bill = await UtilityBill.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        )
            .populate('tenantId', 'name email')
            .populate('apartmentId', 'unitNumber building');

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Utility bill not found'
            });
        }

        res.json({
            success: true,
            data: bill,
            message: `Bill ${action}d successfully`
        });
    } catch (error) {
        console.error('Error reviewing bill:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Send approved bills to tenants (admin only)
router.post('/admin/send-bills', protect, authorize('admin'), async (req, res) => {
    try {
        const { billIds } = req.body;

        // Get approved bills
        const bills = await UtilityBill.find({
            _id: { $in: billIds },
            status: 'approved'
        })
            .populate('tenantId', 'name email')
            .populate('apartmentId', 'unitNumber building');

        if (bills.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No approved bills found to send'
            });
        }

        // Send emails and update status
        const emailResults = [];
        for (const bill of bills) {
            try {
                await emailService.sendUtilityBillEmail({
                    name: bill.tenantId.name,
                    email: bill.tenantId.email,
                    billType: 'Utility Bill',
                    amount: bill.totalAmount,
                    dueDate: bill.dueDate,
                    billMonth: new Date(bill.billingPeriod.startDate).toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric'
                    })
                });

                // Update bill status to 'sent'
                await UtilityBill.findByIdAndUpdate(bill._id, {
                    status: 'sent',
                    sentAt: new Date(),
                    emailSent: true,
                    emailSentAt: new Date()
                });

                emailResults.push({
                    billId: bill._id,
                    billNumber: bill.billNumber,
                    tenant: bill.tenantId.name,
                    success: true
                });
            } catch (error) {
                console.error(`Error sending bill ${bill.billNumber}:`, error);

                // Mark as sent even if email fails
                await UtilityBill.findByIdAndUpdate(bill._id, {
                    status: 'sent',
                    sentAt: new Date(),
                    emailSent: false,
                    emailSentAt: null
                });

                emailResults.push({
                    billId: bill._id,
                    billNumber: bill.billNumber,
                    tenant: bill.tenantId.name,
                    success: false,
                    error: error.message
                });
            }
        }

        const successCount = emailResults.filter(r => r.success).length;
        const failureCount = emailResults.filter(r => !r.success).length;

        res.json({
            success: true,
            message: `Bills processed: ${successCount} successful, ${failureCount} failed`,
            results: emailResults,
            summary: {
                total: bills.length,
                successful: successCount,
                failed: failureCount
            }
        });
    } catch (error) {
        console.error('Error sending bills:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while sending bills'
        });
    }
});

// Mark bill as paid (admin only)
// Enhanced mark bill as paid with beverage consumption update
router.patch('/admin/:id/mark-paid', protect, authorize('admin'), async (req, res) => {
    try {
        const { paymentMethod, notes } = req.body;

        const bill = await UtilityBill.findByIdAndUpdate(
            req.params.id,
            {
                status: 'paid',
                paidAt: new Date(),
                paymentMethod,
                adminNotes: notes
            },
            { new: true }
        )
            .populate('tenantId', 'name email')
            .populate('apartmentId', 'unitNumber building');

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found'
            });
        }

        // Update linked beverage consumption records to 'paid'
        const BeverageConsumption = require('../models/BeverageConsumption');
        const beverageUpdateResult = await BeverageConsumption.updateMany(
            { utilityBillId: bill._id },
            { paymentStatus: 'paid' }
        );

        res.json({
            success: true,
            data: bill,
            message: `Bill marked as paid successfully. Updated ${beverageUpdateResult.modifiedCount} beverage consumption records.`
        });
    } catch (error) {
        console.error('Error marking bill as paid:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get bill statistics (admin only)
router.get('/admin/stats', protect, authorize('admin'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
        }

        const stats = {
            total: await UtilityBill.countDocuments(dateFilter),
            draft: await UtilityBill.countDocuments({ ...dateFilter, status: 'draft' }),
            underReview: await UtilityBill.countDocuments({ ...dateFilter, status: 'under_review' }),
            approved: await UtilityBill.countDocuments({ ...dateFilter, status: 'approved' }),
            sent: await UtilityBill.countDocuments({ ...dateFilter, status: 'sent' }),
            paid: await UtilityBill.countDocuments({ ...dateFilter, status: 'paid' }),
            overdue: await UtilityBill.countDocuments({ ...dateFilter, status: 'overdue' })
        };

        // Revenue statistics
        const revenueStats = await UtilityBill.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: '$status',
                    totalAmount: { $sum: '$totalAmount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // This month's bills
        const thisMonth = new Date();
        const startOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
        const thisMonthStats = {
            generated: await UtilityBill.countDocuments({
                createdAt: { $gte: startOfMonth },
                status: { $ne: 'draft' }
            }),
            sent: await UtilityBill.countDocuments({
                sentAt: { $gte: startOfMonth }
            }),
            paid: await UtilityBill.countDocuments({
                paidAt: { $gte: startOfMonth }
            })
        };

        res.json({
            success: true,
            data: {
                overview: stats,
                revenue: revenueStats,
                thisMonth: thisMonthStats
            }
        });
    } catch (error) {
        console.error('Error fetching bill stats:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ===== TENANT ROUTES =====

// Get tenant's utility bills
router.get('/my-bills', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        const { status, page = 1, limit = 10 } = req.query;

        let query = { tenantId: req.user._id };
        if (status && status !== 'all') query.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const bills = await UtilityBill.find(query)
            .populate('apartmentId', 'unitNumber building')
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        const total = await UtilityBill.countDocuments(query);

        res.json({
            success: true,
            count: bills.length,
            total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            data: bills
        });
    } catch (error) {
        console.error('Error fetching tenant bills:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get single bill details (tenant can only access their own bills)
router.get('/:id', protect, async (req, res) => {
    try {
        const bill = await UtilityBill.findById(req.params.id)
            .populate('tenantId', 'name email')
            .populate('apartmentId', 'unitNumber building');

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found'
            });
        }

        // Check if user is admin or the tenant who owns this bill
        if (req.user.role !== 'admin' && bill.tenantId._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            data: bill
        });
    } catch (error) {
        console.error('Error fetching bill details:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
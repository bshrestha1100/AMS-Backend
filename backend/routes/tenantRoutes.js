const express = require('express');
const User = require('../models/User');
const Apartment = require('../models/Apartment');
const UtilityBill = require('../models/UtilityBill');
const BeverageConsumption = require('../models/BeverageConsumption');
const { protect, authorize } = require('../middleware/auth');
const { validateUserRegistration } = require('../middleware/validation');

const router = express.Router();

// ===== ADMIN TENANT MANAGEMENT ROUTES =====

// Get all tenants (admin only)
router.get('/admin/all', protect, authorize('admin'), async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status, leaseStatus } = req.query;

        // Build query
        let query = { role: 'tenant' };

        // Search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { 'tenantInfo.roomNumber': { $regex: search, $options: 'i' } }
            ];
        }

        // Status filter
        if (status && status !== 'all') {
            if (status === 'active') query.isActive = true;
            if (status === 'inactive') query.isActive = false;
        }

        // Lease status filter
        if (leaseStatus && leaseStatus !== 'all') {
            query['tenantInfo.leaseStatus'] = leaseStatus;
        }

        const tenants = await User.find(query)
            .populate('tenantInfo.apartmentId', 'unitNumber building floor type area')
            .select('-password')
            .sort('-createdAt')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            count: tenants.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: tenants
        });
    } catch (error) {
        console.error('Error fetching tenants:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching tenants'
        });
    }
});

// Get single tenant details (admin only)
router.get('/admin/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const tenant = await User.findOne({
            _id: req.params.id,
            role: 'tenant'
        })
            .populate('tenantInfo.apartmentId', 'unitNumber building floor type area features')
            .select('-password');

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        // Get tenant's bills
        const bills = await UtilityBill.find({ tenantId: tenant._id })
            .sort('-createdAt')
            .limit(5);

        // Get tenant's beverage consumption
        const beverageConsumption = await BeverageConsumption.find({ tenantId: tenant._id })
            .populate('beverageId', 'name category')
            .sort('-consumptionDate')
            .limit(10);

        res.json({
            success: true,
            data: {
                tenant,
                recentBills: bills,
                recentConsumption: beverageConsumption
            }
        });
    } catch (error) {
        console.error('Error fetching tenant details:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching tenant details'
        });
    }
});

// Create new tenant (admin only)
router.post('/admin/create', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            phone,
            tenantInfo
        } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Validate apartment if provided
        if (tenantInfo.apartmentId) {
            const apartment = await Apartment.findById(tenantInfo.apartmentId);
            if (!apartment) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid apartment ID'
                });
            }

            if (apartment.isOccupied) {
                return res.status(400).json({
                    success: false,
                    message: 'Apartment is already occupied'
                });
            }
        }

        // Create tenant
        const tenant = new User({
            name,
            email,
            password, // Will be hashed by pre-save middleware
            role: 'tenant',
            phone,
            tenantInfo: {
                ...tenantInfo,
                leaseStatus: 'active'
            },
            isActive: true
        });

        await tenant.save();

        // Update apartment occupancy if apartment assigned
        if (tenantInfo.apartmentId) {
            await Apartment.findByIdAndUpdate(tenantInfo.apartmentId, {
                isOccupied: true,
                currentTenant: tenant._id
            });
        }

        // Return tenant without password
        const tenantResponse = await User.findById(tenant._id)
            .populate('tenantInfo.apartmentId', 'unitNumber building floor')
            .select('-password');

        res.status(201).json({
            success: true,
            data: tenantResponse,
            message: 'Tenant created successfully'
        });

    } catch (error) {
        console.error('Error creating tenant:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Update tenant (admin only)
router.put('/admin/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const { password, ...updateData } = req.body;

        // If password is being updated, it will be hashed by pre-save middleware
        if (password) {
            updateData.password = password;
        }

        // Handle apartment change
        const currentTenant = await User.findById(req.params.id);
        if (!currentTenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        const oldApartmentId = currentTenant.tenantInfo?.apartmentId;
        const newApartmentId = updateData.tenantInfo?.apartmentId;

        // Validate new apartment if changed
        if (newApartmentId && newApartmentId !== oldApartmentId?.toString()) {
            const apartment = await Apartment.findById(newApartmentId);
            if (!apartment) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid apartment ID'
                });
            }

            if (apartment.isOccupied && apartment.currentTenant?.toString() !== req.params.id) {
                return res.status(400).json({
                    success: false,
                    message: 'Apartment is already occupied by another tenant'
                });
            }
        }

        const tenant = await User.findOneAndUpdate(
            { _id: req.params.id, role: 'tenant' },
            updateData,
            { new: true, runValidators: true }
        )
            .populate('tenantInfo.apartmentId', 'unitNumber building floor')
            .select('-password');

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        // Update apartment occupancy
        if (oldApartmentId && oldApartmentId !== newApartmentId) {
            // Free old apartment
            await Apartment.findByIdAndUpdate(oldApartmentId, {
                isOccupied: false,
                $unset: { currentTenant: 1 }
            });
        }

        if (newApartmentId) {
            // Occupy new apartment
            await Apartment.findByIdAndUpdate(newApartmentId, {
                isOccupied: true,
                currentTenant: tenant._id
            });
        }

        res.json({
            success: true,
            data: tenant,
            message: 'Tenant updated successfully'
        });
    } catch (error) {
        console.error('Error updating tenant:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Delete tenant (admin only)
router.delete('/admin/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const tenant = await User.findOne({ _id: req.params.id, role: 'tenant' });

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        // Free apartment if occupied
        if (tenant.tenantInfo?.apartmentId) {
            await Apartment.findByIdAndUpdate(tenant.tenantInfo.apartmentId, {
                isOccupied: false,
                $unset: { currentTenant: 1 }
            });
        }

        // Mark as historical record instead of deleting
        tenant.isActive = false;
        tenant.isHistoricalRecord = true;
        tenant.tenantInfo.leaseStatus = 'terminated';
        await tenant.save();

        res.json({
            success: true,
            data: {},
            message: 'Tenant deactivated successfully'
        });
    } catch (error) {
        console.error('Error deleting tenant:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Toggle tenant status (admin only)
router.patch('/admin/:id/toggle-status', protect, authorize('admin'), async (req, res) => {
    try {
        const tenant = await User.findOne({ _id: req.params.id, role: 'tenant' });

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        tenant.isActive = !tenant.isActive;
        await tenant.save();

        const tenantResponse = await User.findById(tenant._id)
            .populate('tenantInfo.apartmentId', 'unitNumber building floor')
            .select('-password');

        res.json({
            success: true,
            data: tenantResponse,
            message: `Tenant ${tenant.isActive ? 'activated' : 'deactivated'} successfully`
        });
    } catch (error) {
        console.error('Error toggling tenant status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get tenant statistics (admin only)
router.get('/admin/stats', protect, authorize('admin'), async (req, res) => {
    try {
        const stats = {
            total: await User.countDocuments({ role: 'tenant' }),
            active: await User.countDocuments({ role: 'tenant', isActive: true }),
            inactive: await User.countDocuments({ role: 'tenant', isActive: false }),
            withActiveLeases: await User.countDocuments({
                role: 'tenant',
                'tenantInfo.leaseStatus': 'active'
            }),
            withExpiredLeases: await User.countDocuments({
                role: 'tenant',
                'tenantInfo.leaseStatus': 'expired'
            }),
            withAssignedRooms: await User.countDocuments({
                role: 'tenant',
                'tenantInfo.apartmentId': { $exists: true, $ne: null }
            })
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching tenant stats:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ===== TENANT PROFILE ROUTES =====

// Get tenant's own profile (tenant only)
router.get('/profile', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        const tenant = await User.findById(req.user._id)
            .populate('tenantInfo.apartmentId', 'unitNumber building floor type area features description address')
            .select('-password');

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant profile not found'
            });
        }

        res.json({
            success: true,
            data: tenant
        });
    } catch (error) {
        console.error('Error fetching tenant profile:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching profile'
        });
    }
});

// Update tenant's own profile (tenant only)
router.put('/profile', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        // Only allow certain fields to be updated by tenant
        const allowedUpdates = {};

        if (req.body.name) allowedUpdates.name = req.body.name;
        if (req.body.phone) allowedUpdates.phone = req.body.phone;

        // Allow emergency contact updates
        if (req.body.emergencyContact) {
            allowedUpdates['tenantInfo.emergencyContact'] = req.body.emergencyContact;
        }

        const tenant = await User.findByIdAndUpdate(
            req.user._id,
            allowedUpdates,
            { new: true, runValidators: true }
        )
            .populate('tenantInfo.apartmentId', 'unitNumber building floor type area features description address')
            .select('-password');

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        res.json({
            success: true,
            data: tenant,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Error updating tenant profile:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Get tenant's room details (tenant only)
router.get('/room', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        const tenant = await User.findById(req.user._id)
            .populate('tenantInfo.apartmentId')
            .select('tenantInfo');

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        if (!tenant.tenantInfo?.apartmentId) {
            return res.status(404).json({
                success: false,
                message: 'No room assigned to your account'
            });
        }

        res.json({
            success: true,
            data: tenant.tenantInfo.apartmentId
        });
    } catch (error) {
        console.error('Error fetching room details:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching room details'
        });
    }
});

// Get tenant's utility bills (tenant only)
router.get('/bills', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        const { page = 1, limit = 10, status } = req.query;

        let query = { tenantId: req.user._id };

        if (status && status !== 'all') {
            query.status = status;
        }

        const bills = await UtilityBill.find(query)
            .populate('apartmentId', 'unitNumber building')
            .sort('-createdAt')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await UtilityBill.countDocuments(query);

        res.json({
            success: true,
            count: bills.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: bills
        });
    } catch (error) {
        console.error('Error fetching tenant bills:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching bills'
        });
    }
});

// Get tenant's beverage consumption history (tenant only)
router.get('/beverage-consumption', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        const { page = 1, limit = 20, month, year } = req.query;

        let query = { tenantId: req.user._id };

        // Filter by month/year if provided
        if (month || year) {
            const startDate = new Date(year || new Date().getFullYear(), month ? month - 1 : 0, 1);
            const endDate = new Date(year || new Date().getFullYear(), month ? month : 12, 0);
            query.consumptionDate = { $gte: startDate, $lte: endDate };
        }

        const consumption = await BeverageConsumption.find(query)
            .populate('beverageId', 'name category price')
            .sort('-consumptionDate')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await BeverageConsumption.countDocuments(query);

        // Calculate totals
        const totalAmount = await BeverageConsumption.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        res.json({
            success: true,
            count: consumption.length,
            total,
            totalAmount: totalAmount[0]?.total || 0,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: consumption
        });
    } catch (error) {
        console.error('Error fetching beverage consumption:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching consumption history'
        });
    }
});

// Get tenant dashboard data (tenant only)
router.get('/dashboard', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        // Get tenant with room info
        const tenant = await User.findById(req.user._id)
            .populate('tenantInfo.apartmentId', 'unitNumber building')
            .select('-password');

        // Get recent bills
        const recentBills = await UtilityBill.find({ tenantId: req.user._id })
            .sort('-createdAt')
            .limit(3);

        // Get pending bills
        const pendingBills = await UtilityBill.countDocuments({
            tenantId: req.user._id,
            status: 'pending'
        });

        // Get this month's beverage consumption
        const thisMonth = new Date();
        const startOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
        const endOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 0);

        const monthlyConsumption = await BeverageConsumption.aggregate([
            {
                $match: {
                    tenantId: req.user._id,
                    consumptionDate: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$totalAmount' },
                    totalItems: { $sum: '$quantity' }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                tenant,
                recentBills,
                stats: {
                    pendingBills,
                    monthlyBeverageAmount: monthlyConsumption[0]?.totalAmount || 0,
                    monthlyBeverageItems: monthlyConsumption[0]?.totalItems || 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching tenant dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching dashboard data'
        });
    }
});

module.exports = router;

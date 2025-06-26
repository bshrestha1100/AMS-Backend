const express = require('express');
const RooftopReservation = require('../models/RooftopReservation');
const BeverageCart = require('../models/BeverageCart');
const Beverage = require('../models/Beverage');
const BeverageConsumption = require('../models/BeverageConsumption');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ===== ROOFTOP RESERVATIONS =====

// Get tenant's reservations
router.get('/reservations', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        const reservations = await RooftopReservation.find({ tenantId: req.user._id })
            .sort('-reservationDate');

        res.json({
            success: true,
            count: reservations.length,
            data: reservations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Create new reservation
router.post('/reservations', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        const reservationData = {
            ...req.body,
            tenantId: req.user._id,
            roomNumber: req.user.tenantInfo?.roomNumber,
            contactPhone: req.user.phone
        };

        const reservation = await RooftopReservation.create(reservationData);

        res.status(201).json({
            success: true,
            data: reservation,
            message: 'Reservation created successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Cancel reservation
router.patch('/reservations/:id/cancel', protect, async (req, res) => {
    try {
        const reservation = await RooftopReservation.findOne({
            _id: req.params.id,
            tenantId: req.user._id
        });

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: 'Reservation not found'
            });
        }

        if (reservation.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel completed reservation'
            });
        }

        reservation.status = 'cancelled';
        await reservation.save();

        res.json({
            success: true,
            data: reservation,
            message: 'Reservation cancelled successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ===== BEVERAGE CART =====

// Get tenant's cart
router.get('/cart', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        let cart = await BeverageCart.findOne({
            tenantId: req.user._id,
            status: 'active'
        }).populate('items.beverageId', 'name category price');

        if (!cart) {
            cart = await BeverageCart.create({
                tenantId: req.user._id,
                items: [],
                totalAmount: 0
            });
        }

        res.json({
            success: true,
            data: cart
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Add item to cart
router.post('/cart/add', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        const { beverageId, quantity } = req.body;

        // Get beverage details
        const beverage = await Beverage.findById(beverageId);
        if (!beverage) {
            return res.status(404).json({
                success: false,
                message: 'Beverage not found'
            });
        }

        if (!beverage.isAvailable) {
            return res.status(400).json({
                success: false,
                message: 'Beverage is not available'
            });
        }

        // Find or create cart
        let cart = await BeverageCart.findOne({
            tenantId: req.user._id,
            status: 'active'
        });

        if (!cart) {
            cart = new BeverageCart({
                tenantId: req.user._id,
                items: []
            });
        }

        // Check if item already exists in cart
        const existingItemIndex = cart.items.findIndex(
            item => item.beverageId.toString() === beverageId
        );

        if (existingItemIndex > -1) {
            // Update existing item
            cart.items[existingItemIndex].quantity += quantity;
            cart.items[existingItemIndex].totalPrice =
                cart.items[existingItemIndex].quantity * beverage.price;
        } else {
            // Add new item
            cart.items.push({
                beverageId,
                beverageName: beverage.name,
                quantity,
                unitPrice: beverage.price,
                totalPrice: quantity * beverage.price
            });
        }

        await cart.save();

        // Populate beverage details
        await cart.populate('items.beverageId', 'name category price');

        res.json({
            success: true,
            data: cart,
            message: 'Item added to cart successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Update cart item quantity
router.put('/cart/item/:itemId', protect, async (req, res) => {
    try {
        const { quantity } = req.body;

        const cart = await BeverageCart.findOne({
            tenantId: req.user._id,
            status: 'active'
        });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        const item = cart.items.id(req.params.itemId);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in cart'
            });
        }

        if (quantity <= 0) {
            cart.items.pull(req.params.itemId);
        } else {
            item.quantity = quantity;
            item.totalPrice = quantity * item.unitPrice;
        }

        await cart.save();
        await cart.populate('items.beverageId', 'name category price');

        res.json({
            success: true,
            data: cart,
            message: 'Cart updated successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Checkout cart - convert to consumption
router.post('/cart/checkout', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        // Find active cart
        const cart = await BeverageCart.findOne({
            tenantId: req.user._id,
            status: 'active'
        }).populate('items.beverageId', 'name category');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        // Create consumption records for each cart item
        const consumptionRecords = cart.items.map(item => ({
            tenantId: req.user._id,
            beverageId: item.beverageId._id,
            beverageName: item.beverageName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalAmount: item.totalPrice,
            consumptionDate: new Date(),
            roomNumber: req.user.tenantInfo?.roomNumber,
            apartmentId: req.user.tenantInfo?.apartmentId,
            status: 'consumed'
        }));

        // Save all consumption records
        await BeverageConsumption.insertMany(consumptionRecords);

        // Update cart status to 'ordered'
        cart.status = 'ordered';
        cart.orderedAt = new Date();
        await cart.save();

        res.json({
            success: true,
            data: {
                totalItems: cart.items.length,
                totalAmount: cart.totalAmount,
                consumptionRecords: consumptionRecords.length
            },
            message: 'Order placed successfully! Items will be added to your monthly bill.'
        });

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during checkout'
        });
    }
});


// Remove item from cart
router.delete('/cart/item/:itemId', protect, async (req, res) => {
    try {
        const cart = await BeverageCart.findOne({
            tenantId: req.user._id,
            status: 'active'
        });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        cart.items.pull(req.params.itemId);
        await cart.save();
        await cart.populate('items.beverageId', 'name category price');

        res.json({
            success: true,
            data: cart,
            message: 'Item removed from cart'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get beverage consumption history
router.get('/consumption-history', protect, async (req, res) => {
    try {
        if (req.user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant role required.'
            });
        }

        const consumptionHistory = await BeverageConsumption.find({ tenantId: req.user._id })
            .populate('beverageId', 'name category')
            .sort('-consumptionDate');

        res.json({
            success: true,
            count: consumptionHistory.length,
            data: consumptionHistory
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get available beverages
router.get('/beverages', protect, async (req, res) => {
    try {
        const beverages = await Beverage.find({ isAvailable: true }).sort('name');

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

// Get all reservations (admin only)
router.get('/reservations/admin/all', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin role required.'
            });
        }

        const reservations = await RooftopReservation.find()
            .populate('tenantId', 'name email phone tenantInfo.roomNumber')
            .sort('-createdAt');

        res.json({
            success: true,
            count: reservations.length,
            data: reservations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Admin review rooftop reservation
router.put('/reservations/:id/review', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin role required.'
            });
        }

        const { status, adminNotes } = req.body;

        if (!['confirmed', 'cancelled'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be either confirmed or cancelled'
            });
        }

        const reservation = await RooftopReservation.findByIdAndUpdate(
            req.params.id,
            {
                status,
                adminNotes,
                reviewedAt: new Date(),
                reviewedBy: req.user._id
            },
            { new: true }
        ).populate('tenantId', 'name email phone tenantInfo.roomNumber');

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: 'Reservation not found'
            });
        }

        res.json({
            success: true,
            data: reservation,
            message: `Reservation ${status} successfully`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;

// controllers/tenantController.js
const User = require('../models/User');
const BeverageConsumption = require('../models/BeverageConsumption');

// Get tenant details
exports.getTenantDetails = async (req, res) => {
    try {
        const tenant = await User.findById(req.params.tenantId).select('-password');
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant not found' });
        }
        res.json({ success: true, data: tenant });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get tenant beverage consumption
exports.getTenantBeverageConsumption = async (req, res) => {
    try {
        const consumption = await BeverageConsumption.find({ tenantId: req.params.tenantId }).sort({ consumptionDate: -1 });
        res.json({ success: true, count: consumption.length, data: consumption });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Record beverage consumption
exports.recordBeverageConsumption = async (req, res) => {
    try {
        const { tenantId, beverageId, quantity } = req.body;
        // Add validation and logic here
        // For now, just respond success
        res.status(201).json({ success: true, message: 'Beverage consumption recorded' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

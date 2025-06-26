const mongoose = require('mongoose');
require('dotenv').config();

// Import User model
const User = require('../models/User');

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected for admin creation');
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

// Create hardcoded admin user
const createAdminUser = async () => {
    try {
        // First, delete any existing admin user
        await User.deleteOne({ email: 'admin@apartment.com' });
        console.log('Deleted existing admin user (if any)');

        // Create admin user - DON'T hash password here, let the pre-save middleware do it
        const adminUser = new User({
            name: 'System Administrator',
            email: 'admin@apartment.com',
            password: 'Admin@123456', // Plain text - will be hashed by pre-save hook
            role: 'admin',
            phone: '+1-555-0000',
            isActive: true
        });

        await adminUser.save();
        console.log('✅ Admin user created successfully!');
        console.log('📧 Email: admin@apartment.com');
        console.log('🔑 Password: Admin@123456');
        console.log('👤 Role: admin');

        // Test the password immediately
        const testUser = await User.findOne({ email: 'admin@apartment.com' }).select('+password');
        const isMatch = await testUser.matchPassword('Admin@123456');
        console.log('🧪 Password test:', isMatch ? 'PASS' : 'FAIL');

    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        mongoose.connection.close();
    }
};

// Run the script
const runScript = async () => {
    await connectDB();
    await createAdminUser();
};

runScript();

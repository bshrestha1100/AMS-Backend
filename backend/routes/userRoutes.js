const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Apartment = require('../models/Apartment');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Add this import at the top
const emailService = require('../services/emailService');

// Update your user creation route
router.post('/', protect, authorize('admin'), async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { name, email, password, role, phone, tenantInfo, workerInfo } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email }).session(session);
        if (existingUser) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Validate required fields based on role
        if (role === 'tenant' && (!tenantInfo || !tenantInfo.roomNumber || !tenantInfo.monthlyRent)) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Tenant information is required for tenant role'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user object - THIS IS THE FIX
        const userDataToCreate = {  // Changed from userData to userDataToCreate
            name,
            email,
            password: hashedPassword,
            role,
            phone,
            isActive: true
        };

        // Add role-specific information
        if (role === 'tenant' && tenantInfo) {
            userDataToCreate.tenantInfo = tenantInfo;  // Use userDataToCreate
        }

        if (role === 'worker' && workerInfo) {
            userDataToCreate.workerInfo = workerInfo;  // Use userDataToCreate
        }

        // Create user - FIX LINE 24
        const user = await User.create([userDataToCreate], { session });  // Use userDataToCreate instead of userData
        const createdUser = user[0];

        // Handle apartment assignment
        let apartmentInfo = null;
        if (role === 'tenant' && tenantInfo?.apartmentId) {
            const apartment = await Apartment.findById(tenantInfo.apartmentId).session(session);
            
            if (!apartment) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: 'Apartment not found'
                });
            }
            
            if (apartment.isOccupied) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: 'Apartment is already occupied'
                });
            }

            await Apartment.findByIdAndUpdate(
                tenantInfo.apartmentId,
                {
                    isOccupied: true,
                    currentTenant: createdUser._id,
                    occupiedDate: new Date()
                },
                { session }
            );

            apartmentInfo = apartment;
        }

        await session.commitTransaction();

        // Send welcome email for tenants
        if (role === 'tenant') {
            try {
                await emailService.sendWelcomeEmail({
                    name,
                    email,
                    password, // Original password before hashing
                    roomNumber: tenantInfo?.roomNumber,
                    apartmentInfo: apartmentInfo ? {
                        unitNumber: apartmentInfo.unitNumber,
                        building: apartmentInfo.building,
                        floor: apartmentInfo.floor
                    } : null
                });
            } catch (emailError) {
                console.error('Failed to send welcome email:', emailError);
                // Don't fail the user creation if email fails
            }
        }
        
        // Return user without password
        const userResponse = await User.findById(createdUser._id).select('-password');
        
        res.status(201).json({
            success: true,
            data: userResponse,
            message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully${role === 'tenant' ? ' and welcome email sent' : ''}`
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error creating user:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    } finally {
        session.endSession();
    }
});


// Get all users (admin only)
router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        const users = await User.find().select('-password').sort('-createdAt');

        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Create new user (admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { name, email, password, role, phone, tenantInfo, workerInfo } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email }).session(session);
        if (existingUser) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Validate required fields based on role
        if (role === 'tenant' && (!tenantInfo || !tenantInfo.roomNumber || !tenantInfo.monthlyRent)) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Tenant information is required for tenant role'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user object
        const userData = {
            name,
            email,
            password: hashedPassword,
            role,
            phone,
            isActive: true,
        };

        // Add role-specific information
        if (role === 'tenant' && tenantInfo) {
            userData.tenantInfo = tenantInfo;
        }

        if (role === 'worker' && workerInfo) {
            userData.workerInfo = workerInfo;
        }

        // Create user
        const user = await User.create([userData], { session });
        const createdUser = user[0];

        // If tenant and apartment selected, mark apartment as occupied
        if (role === 'tenant' && tenantInfo?.apartmentId) {
            const apartment = await Apartment.findById(tenantInfo.apartmentId).session(session);
            
            if (!apartment) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: 'Apartment not found'
                });
            }
            
            if (apartment.isOccupied) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: 'Apartment is already occupied'
                });
            }

            await Apartment.findByIdAndUpdate(
                tenantInfo.apartmentId,
                {
                    isOccupied: true,
                    currentTenant: createdUser._id,
                    occupiedDate: new Date()
                },
                { session }
            );
        }

        await session.commitTransaction();
        
        // Return user without password
        const userResponse = await User.findById(createdUser._id).select('-password');
        
        res.status(201).json({
            success: true,
            data: userResponse,
            message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully`
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error creating user:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    } finally {
        session.endSession();
    }
});

// Get single user (admin only)
router.get('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Update user (admin only)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { password, ...updateData } = req.body;

        // If password is being updated, hash it
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        // Handle apartment assignment changes
        if (updateData.tenantInfo?.apartmentId !== undefined) {
            const user = await User.findById(req.params.id).session(session);
            const oldApartmentId = user.tenantInfo?.apartmentId;
            const newApartmentId = updateData.tenantInfo?.apartmentId;

            // Clear old apartment if changed
            if (oldApartmentId && oldApartmentId !== newApartmentId) {
                await Apartment.findByIdAndUpdate(
                    oldApartmentId,
                    { 
                        isOccupied: false, 
                        $unset: { currentTenant: 1, occupiedDate: 1 },
                        lastVacatedDate: new Date()
                    },
                    { session }
                );
            }

            // Assign new apartment
            if (newApartmentId && newApartmentId !== oldApartmentId) {
                const apartment = await Apartment.findById(newApartmentId).session(session);
                
                if (!apartment) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        message: 'Apartment not found'
                    });
                }
                
                if (apartment.isOccupied) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        message: 'Apartment is already occupied'
                    });
                }

                await Apartment.findByIdAndUpdate(
                    newApartmentId,
                    { 
                        isOccupied: true, 
                        currentTenant: req.params.id,
                        occupiedDate: new Date()
                    },
                    { session }
                );
            }
        }

        // Update user
        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true, session }
        ).select('-password');

        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await session.commitTransaction();

        res.json({
            success: true,
            data: user,
            message: 'User updated successfully'
        });
        
    } catch (error) {
        await session.abortTransaction();
        console.error('Error updating user:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    } finally {
        session.endSession();
    }
});

// Delete user (admin only) - Enhanced to preserve related data
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findById(req.params.id).session(session);

        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent admin from deleting themselves
        if (user._id.toString() === req.user._id.toString()) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'You cannot delete your own account'
            });
        }

        // **IMPORTANT: Consider soft delete instead of hard delete to preserve data**
        // Option 1: Soft delete (recommended)
        await User.findByIdAndUpdate(
            req.params.id,
            { 
                isActive: false,
                isDeleted: true, // Add this field to your User model
                deletedAt: new Date()
            },
            { session }
        );

        // Free up apartment if user has one
        if (user.tenantInfo?.apartmentId) {
            await Apartment.findByIdAndUpdate(
                user.tenantInfo.apartmentId,
                { 
                    isOccupied: false, 
                    $unset: { currentTenant: 1, occupiedDate: 1 },
                    lastVacatedDate: new Date()
                },
                { session }
            );
        }

        // **NOTE: This preserves all related data:**
        // - Beverage consumption records remain linked to user ID
        // - Maintenance requests remain linked to user ID  
        // - Payment records remain linked to user ID
        // - Utility bills remain linked to user ID
        // - All historical data is preserved for reporting

        await session.commitTransaction();

        res.json({
            success: true,
            data: {},
            message: 'User deleted successfully (data preserved)'
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    } finally {
        session.endSession();
    }
});


// Toggle user status (admin only)
router.patch('/:id/toggle-status', protect, authorize('admin'), async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findById(req.params.id).session(session);

        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent admin from deactivating themselves
        if (user._id.toString() === req.user._id.toString()) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'You cannot deactivate your own account'
            });
        }

        // **KEY FIX: Handle apartment status when user is deactivated**
        if (user.isActive && user.role === 'tenant' && user.tenantInfo?.apartmentId) {
            // User is being deactivated and has an apartment - make apartment available
            await Apartment.findByIdAndUpdate(
                user.tenantInfo.apartmentId,
                { 
                    isOccupied: false, 
                    $unset: { currentTenant: 1, occupiedDate: 1 },
                    lastVacatedDate: new Date()
                },
                { session }
            );
        } else if (!user.isActive && user.role === 'tenant' && user.tenantInfo?.apartmentId) {
            // User is being reactivated and has an apartment - check if apartment is still available
            const apartment = await Apartment.findById(user.tenantInfo.apartmentId).session(session);
            
            if (apartment && !apartment.isOccupied) {
                // Apartment is available, assign it back to the user
                await Apartment.findByIdAndUpdate(
                    user.tenantInfo.apartmentId,
                    { 
                        isOccupied: true, 
                        currentTenant: user._id,
                        occupiedDate: new Date()
                    },
                    { session }
                );
            } else if (apartment && apartment.isOccupied) {
                // Apartment is now occupied by someone else, clear user's apartment reference
                await User.findByIdAndUpdate(
                    user._id,
                    { 
                        $unset: { 'tenantInfo.apartmentId': 1 }
                    },
                    { session }
                );
            }
        }

        // Toggle user status (PRESERVE ALL USER DATA)
        user.isActive = !user.isActive;
        await user.save({ session });

        await session.commitTransaction();

        // Return user without password
        const userResponse = await User.findById(user._id).select('-password');

        res.json({
            success: true,
            data: userResponse,
            message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error toggling user status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    } finally {
        session.endSession();
    }
});


module.exports = router;

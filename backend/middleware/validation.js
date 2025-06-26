// middleware/validation.js
const { body, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation errors',
            errors: errors.array()
        });
    }
    next();
};

// User registration validation
const validateUserRegistration = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('role')
        .isIn(['admin', 'tenant', 'worker'])
        .withMessage('Role must be admin, tenant, or worker'),
    validate
];

// Login validation
const validateLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    validate
];

// Utility reading validation
const validateUtilityReading = [
    body('apartmentId')
        .isMongoId()
        .withMessage('Valid apartment ID is required'),
    body('electricity.previousReading')
        .isNumeric()
        .withMessage('Previous electricity reading must be a number'),
    body('electricity.currentReading')
        .isNumeric()
        .withMessage('Current electricity reading must be a number'),
    body('heatingCooling.previousReading')
        .isNumeric()
        .withMessage('Previous heating/cooling reading must be a number'),
    body('heatingCooling.currentReading')
        .isNumeric()
        .withMessage('Current heating/cooling reading must be a number'),
    validate
];

// Leave request validation
const validateLeaveRequest = [
    body('leaveType')
        .isIn(['sick', 'personal', 'vacation', 'emergency', 'maternity', 'paternity', 'other'])
        .withMessage('Invalid leave type'),
    body('startDate')
        .isISO8601()
        .withMessage('Valid start date is required'),
    body('endDate')
        .isISO8601()
        .withMessage('Valid end date is required'),
    body('reason')
        .trim()
        .isLength({ min: 10, max: 500 })
        .withMessage('Reason must be between 10 and 500 characters'),
    validate
];

// Beverage validation
const validateBeverage = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Beverage name must be between 2 and 100 characters'),
    body('category')
        .isIn(['Alcoholic', 'Non-Alcoholic'])
        .withMessage('Category must be Alcoholic or Non-Alcoholic'),
    body('price')
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    validate
];

module.exports = {
    validate,
    validateUserRegistration,
    validateLogin,
    validateUtilityReading,
    validateLeaveRequest,
    validateBeverage
};

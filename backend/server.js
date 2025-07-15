require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');


// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const apartmentRoutes = require('./routes/apartmentRoutes');
const utilityRoutes = require('./routes/utilityRoutes');
const beverageRoutes = require('./routes/beverageRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const rooftopRoutes = require('./routes/rooftopRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const workerRoutes = require('./routes/workerRoutes');
const beverageConsumptionRoutes = require('./routes/beverageConsumptionRoutes');
const utilityBillRoutes = require('./routes/utilityBillRoutes');
const LeaseExpiryJob = require('./jobs/leaseExpiryJob');
// const emailService = require('./services/emailService');
// emailService.testConnection();

// Import services
const MonthlyBillingService = require('./jobs/monthlyBilling');

// Import middleware
const { protect, authorize } = require('./middleware/auth');

const app = express();

// CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.CLIENT_URL || 'http://localhost:3000',
            'http://localhost:5173',
            'http://127.0.0.1:5173'
        ];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Body parser middleware
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            res.status(400).json({ success: false, message: 'Invalid JSON format' });
            throw new Error('Invalid JSON');
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// MongoDB connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {});
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

connectDB();

mongoose.connection.on('disconnected', () => console.log('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        uptime: process.uptime(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/apartments', apartmentRoutes);
app.use('/api/utilities', utilityRoutes);
app.use('/api/beverages', beverageRoutes);
app.use('/api/leave-requests', leaveRoutes);
app.use('/api/rooftop', rooftopRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/beverage-consumption', beverageConsumptionRoutes);
app.use('/api/utility-bills', utilityBillRoutes);

// Admin endpoints
app.post('/api/admin/trigger-billing', protect, authorize('admin'), async (req, res) => {
    try {
        console.log(`Manual billing triggered by admin: ${req.user.email}`);
        const result = await MonthlyBillingService.triggerManualBilling();
        res.json({
            success: true,
            data: result,
            message: 'Manual billing completed successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Manual billing error:', error);
        res.status(500).json({
            success: false,
            message: 'Billing process failed',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

app.get('/api/admin/stats', protect, authorize('admin'), async (req, res) => {
    try {
        const User = require('./models/User');
        const Apartment = require('./models/Apartment');
        const UtilityBill = require('./models/UtilityBill');
        const RooftopReservation = require('./models/RooftopReservation');
        const BeverageConsumption = require('./models/BeverageConsumption');
        const MaintenanceRequest = require('./models/MaintenanceRequest');

        const stats = {
            users: {
                total: await User.countDocuments(),
                tenants: await User.countDocuments({ role: 'tenant' }),
                workers: await User.countDocuments({ role: 'worker' }),
                admins: await User.countDocuments({ role: 'admin' }),
                active: await User.countDocuments({ isActive: true })
            },
            apartments: {
                total: await Apartment.countDocuments(),
                occupied: await Apartment.countDocuments({ isOccupied: true }),
                available: await Apartment.countDocuments({ isOccupied: false })
            },
            bills: {
                total: await UtilityBill.countDocuments(),
                pending: await UtilityBill.countDocuments({ status: 'pending' }),
                paid: await UtilityBill.countDocuments({ status: 'paid' }),
                overdue: await UtilityBill.countDocuments({ status: 'overdue' })
            },
            reservations: {
                total: await RooftopReservation.countDocuments(),
                pending: await RooftopReservation.countDocuments({ status: 'pending' }),
                confirmed: await RooftopReservation.countDocuments({ status: 'confirmed' }),
                completed: await RooftopReservation.countDocuments({ status: 'completed' })
            },
            beverageConsumption: {
                total: await BeverageConsumption.countDocuments(),
                thisMonth: await BeverageConsumption.countDocuments({
                    consumptionDate: {
                        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                    }
                })
            },
            maintenance: {
                total: await MaintenanceRequest.countDocuments(),
                pending: await MaintenanceRequest.countDocuments({ status: 'Pending' }),
                assigned: await MaintenanceRequest.countDocuments({ status: 'Assigned' }),
                inProgress: await MaintenanceRequest.countDocuments({ status: 'In Progress' }),
                completed: await MaintenanceRequest.countDocuments({ status: 'Completed' })
            }
        };

        res.json({ success: true, data: stats, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
    }
});


// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ success: false, message: 'Validation Error', errors });
    }

    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).json({ success: false, message: `${field} already exists` });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired' });
    }

    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ success: false, message: 'CORS policy violation' });
    }

    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? { message: err.message, stack: err.stack } : {}
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString()
    });
});

// Server start
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
    console.log('🚀 Server started');
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   URL: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});

// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
    
//     // Start lease expiry notification job
//     LeaseExpiryJob.start();
// });

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n📴 Received ${signal}. Gracefully shutting down...`);
    server.close(async () => {
        try {
            await mongoose.connection.close();
            console.log('🗄️  MongoDB disconnected');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    });

    setTimeout(() => {
        console.error('⚠️  Force shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = app;

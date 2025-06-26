const mongoose = require('mongoose');

const maintenanceRequestSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    apartmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Apartment',
        required: true
    },
    assignedWorkerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    title: {
        type: String,
        required: true,
        maxlength: 100
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000
    },
    category: {
        type: String,
        enum: ['Plumbing', 'Electrical', 'HVAC', 'Appliances', 'Cleaning', 'Painting', 'Carpentry', 'Other'],
        required: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Emergency'],
        default: 'Medium'
    },
    status: {
        type: String,
        enum: ['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled'],
        default: 'Pending'
    },
    requestDate: {
        type: Date,
        default: Date.now
    },
    assignedDate: Date,
    startedDate: Date,
    completedDate: Date,
    estimatedCompletionTime: String,
    actualCompletionTime: String,
    workNotes: String,
    adminNotes: String,
    tenantFeedback: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String,
        submittedAt: Date
    }
}, {
    timestamps: true
});

// Index for better query performance
maintenanceRequestSchema.index({ tenantId: 1, status: 1 });
maintenanceRequestSchema.index({ assignedWorkerId: 1, status: 1 });
maintenanceRequestSchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);

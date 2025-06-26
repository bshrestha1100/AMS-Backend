const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  leaveType: {
    type: String,
    required: [true, 'Please specify leave type'],
    enum: ['Sick Leave', 'Vacation', 'Personal Leave', 'Emergency Leave', 'Maternity/Paternity Leave', 'Other']
  },
  startDate: {
    type: Date,
    required: [true, 'Please provide start date']
  },
  endDate: {
    type: Date,
    required: [true, 'Please provide end date']
  },
  totalDays: {
    type: Number,
    required: [true, 'Total days is required'],
    min: [1, 'Total days must be at least 1']
  },
  reason: {
    type: String,
    required: [true, 'Please provide reason for leave'],
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  reviewNotes: String
}, {
  timestamps: true
});

// Validate that end date is after start date
leaveRequestSchema.pre('save', function(next) {
  if (this.endDate < this.startDate) {
    next(new Error('End date must be after start date'));
  }
  next();
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);

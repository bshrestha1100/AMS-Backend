const express = require('express');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// ===== TENANT ROUTES =====

// Submit maintenance request (tenant only)
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    const requestData = {
      ...req.body,
      tenantId: req.user._id,
      apartmentId: req.user.tenantInfo?.apartmentId
    };

    if (!requestData.apartmentId) {
      return res.status(400).json({
        success: false,
        message: 'No apartment assigned to your account'
      });
    }

    const maintenanceRequest = await MaintenanceRequest.create(requestData);

    const populatedRequest = await MaintenanceRequest.findById(maintenanceRequest._id)
      .populate('tenantId', 'name email')
      .populate('apartmentId', 'unitNumber building');

    res.status(201).json({
      success: true,
      data: populatedRequest,
      message: 'Maintenance request submitted successfully'
    });
  } catch (error) {
    console.error('Error creating maintenance request:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get tenant's maintenance requests
router.get('/my-requests', protect, async (req, res) => {
  try {
    if (req.user.role !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Tenant role required.'
      });
    }

    const requests = await MaintenanceRequest.find({ tenantId: req.user._id })
      .populate('assignedWorkerId', 'name phone')
      .populate('apartmentId', 'unitNumber building')
      .sort('-createdAt');

    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching tenant requests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ===== WORKER ROUTES =====

// Get worker's assigned maintenance requests
router.get('/my-assignments', protect, async (req, res) => {
  try {
    if (req.user.role !== 'worker') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Worker role required.'
      });
    }

    const requests = await MaintenanceRequest.find({ assignedWorkerId: req.user._id })
      .populate('tenantId', 'name email phone tenantInfo.roomNumber')
      .populate('apartmentId', 'unitNumber building floor')
      .sort('-assignedDate');

    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching worker assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update maintenance request status (worker)
router.patch('/:id/status', protect, async (req, res) => {
  try {
    if (req.user.role !== 'worker') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Worker role required.'
      });
    }

    const { status, workNotes, estimatedCompletionTime } = req.body;

    const request = await MaintenanceRequest.findOne({
      _id: req.params.id,
      assignedWorkerId: req.user._id
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance request not found or not assigned to you'
      });
    }

    // Update status and related fields
    request.status = status;
    if (workNotes) request.workNotes = workNotes;
    if (estimatedCompletionTime) request.estimatedCompletionTime = estimatedCompletionTime;

    if (status === 'In Progress' && !request.startedDate) {
      request.startedDate = new Date();
    }

    if (status === 'Completed') {
      request.completedDate = new Date();
      if (request.startedDate) {
        const timeDiff = request.completedDate - request.startedDate;
        const hours = Math.round(timeDiff / (1000 * 60 * 60) * 10) / 10;
        request.actualCompletionTime = `${hours} hours`;
      }
    }

    await request.save();

    const updatedRequest = await MaintenanceRequest.findById(request._id)
      .populate('tenantId', 'name email')
      .populate('apartmentId', 'unitNumber building');

    res.json({
      success: true,
      data: updatedRequest,
      message: 'Request status updated successfully'
    });
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ===== ADMIN ROUTES =====

// Get all maintenance requests (admin only)
router.get('/admin/all', protect, authorize('admin'), async (req, res) => {
  try {
    const { status, priority, category } = req.query;

    let query = {};
    if (status && status !== 'all') query.status = status;
    if (priority && priority !== 'all') query.priority = priority;
    if (category && category !== 'all') query.category = category;

    const requests = await MaintenanceRequest.find(query)
      .populate('tenantId', 'name email phone tenantInfo.roomNumber')
      .populate('apartmentId', 'unitNumber building floor')
      .populate('assignedWorkerId', 'name email phone')
      .sort('-createdAt');

    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching all requests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Assign maintenance request to worker (admin only)
router.patch('/:id/assign', protect, authorize('admin'), async (req, res) => {
  try {
    const { workerId, adminNotes, priority } = req.body;

    // Verify worker exists and is active
    const worker = await User.findOne({ _id: workerId, role: 'worker', isActive: true });
    if (!worker) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive worker'
      });
    }

    const request = await MaintenanceRequest.findByIdAndUpdate(
      req.params.id,
      {
        assignedWorkerId: workerId,
        status: 'Assigned',
        assignedDate: new Date(),
        adminNotes,
        ...(priority && { priority })
      },
      { new: true }
    )
      .populate('tenantId', 'name email')
      .populate('apartmentId', 'unitNumber building')
      .populate('assignedWorkerId', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance request not found'
      });
    }

    res.json({
      success: true,
      data: request,
      message: 'Request assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning request:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get available workers (admin only)
router.get('/admin/workers', protect, authorize('admin'), async (req, res) => {
  try {
    const workers = await User.find({
      role: 'worker',
      isActive: true
    }).select('name email phone workerInfo');

    res.json({
      success: true,
      data: workers
    });
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update maintenance request status (admin only)
router.patch('/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { status, adminNotes } = req.body;

    const request = await MaintenanceRequest.findByIdAndUpdate(
      req.params.id,
      { status, adminNotes },
      { new: true }
    )
      .populate('tenantId', 'name email')
      .populate('apartmentId', 'unitNumber building')
      .populate('assignedWorkerId', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance request not found'
      });
    }

    res.json({
      success: true,
      data: request,
      message: 'Request status updated successfully'
    });
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;

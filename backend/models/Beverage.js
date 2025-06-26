const mongoose = require('mongoose');

const beverageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide beverage name'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Please provide price'],
    min: [0, 'Price cannot be negative']
  },
  category: {
    type: String,
    required: [true, 'Please specify category'],
    enum: {
      values: ['Alcoholic', 'Non-Alcoholic'],
      message: 'Category must be either Alcoholic or Non-Alcoholic'
    }
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock cannot be negative']
  }
}, {
  timestamps: true
});

// Index for better query performance
beverageSchema.index({ category: 1, isAvailable: 1 });
beverageSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Beverage', beverageSchema);

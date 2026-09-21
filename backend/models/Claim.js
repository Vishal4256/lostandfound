const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.ObjectId,
    ref: 'Item',
    required: [true, 'Associated item is required']
  },
  claimant: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Claimant user is required']
  },
  proofDetails: {
    type: String,
    required: [true, 'Proof details (identifying marks, serial numbers, secret info) are required'],
    trim: true,
    maxlength: [2000, 'Proof details cannot exceed 2000 characters']
  },
  proofImage: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

// Compound index on item and claimant
claimSchema.index({ item: 1, claimant: 1 });

module.exports = mongoose.model('Claim', claimSchema);

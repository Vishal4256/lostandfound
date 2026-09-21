const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    default: '',
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: true,
    enum: {
      values: [
        'Electronics',
        'Accessories',
        'Clothing',
        'Documents',
        'Keys',
        'Pets',
        'Jewellery',
        'Wallets',
        'IDs',
        'Books',
        'Other'
      ],
      message: '`{VALUE}` is not a supported category'
    }
  },
  // Supports both itemType and type ('lost' | 'found')
  type: {
    type: String,
    enum: ['lost', 'found']
  },
  itemType: {
    type: String,
    enum: ['lost', 'found']
  },
  date: {
    type: Date,
    default: Date.now
  },
  location: {
    addressText: { type: String, default: 'Unknown' },
    coordinates: { type: [Number], default: undefined } // [longitude, latitude]
  },
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required']
  },
  // Supports both reportedBy and reporterId
  reportedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  reporterId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['Active', 'Pending Claim', 'Resolved'],
    default: 'Active',
    set: function(val) {
      if (!val) return 'Active';
      const clean = val.toLowerCase().replace(/_/g, ' ');
      if (clean === 'active') return 'Active';
      if (clean === 'pending claim' || clean === 'pending_claim' || clean === 'pending') return 'Pending Claim';
      if (clean === 'resolved') return 'Resolved';
      return val;
    }
  },
  embedding: {
    type: [Number],
    required: true,
    validate: {
      validator: (v) => Array.isArray(v) && v.length === 512,
      message: 'Embedding must be exactly 512 numbers'
    }
  }
}, { timestamps: true });

// Pre-validate & pre-save hook to ensure synchronization between aliases
itemSchema.pre('validate', function() {
  if (!this.type && this.itemType) this.type = this.itemType;
  if (!this.itemType && this.type) this.itemType = this.type;
  if (!this.reportedBy && this.reporterId) this.reportedBy = this.reporterId;
  if (!this.reporterId && this.reportedBy) this.reporterId = this.reportedBy;
});

itemSchema.index({ type: 1, status: 1 });
itemSchema.index({ category: 1, status: 1 });
itemSchema.index({ reportedBy: 1 });

module.exports = mongoose.model('Item', itemSchema);

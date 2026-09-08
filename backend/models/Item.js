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
      values: ['Electronics', 'Accessories', 'Clothing', 'Documents', 'Keys', 'Pets', 'Jewellery', 'Other'],
      message: '`{VALUE}` is not a supported category'
    }
  },
  type: {
    type: String,
    required: true,
    enum: ['lost', 'found']
  },
  date: {
    type: Date,
    default: Date.now
  },
  location: {
    addressText: { type: String, default: 'Unknown' },
    coordinates: { type: [Number], default: undefined },
  },
  imageUrl: {
    type: String,
    required: true
  },
  reporterId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['Active', 'Pending Claim', 'Resolved'],
    default: 'Active'
  },
  embedding: {
    type: [Number],
    required: true,
    validate: {
      validator: (v) => v.length === 512,
      message: 'Embedding must be exactly 512 numbers'
    }
  }
}, { timestamps: true });

itemSchema.index({ type: 1, status: 1 });

/*
======================================================================
  MONGODB ATLAS $vectorSearch INDEX — create manually in Atlas UI
  Index name: vector_index | Collection: items
  {
    "fields": [
      { "numDimensions": 512, "path": "embedding", "similarity": "cosine", "type": "vector" },
      { "path": "type", "type": "filter" },
      { "path": "status", "type": "filter" },
      { "path": "category", "type": "filter" }
    ]
  }
======================================================================
*/

module.exports = mongoose.model('Item', itemSchema);

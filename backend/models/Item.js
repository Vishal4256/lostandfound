const mongoose = require('mongoose');

// Define the core schema for a Lost/Found Item
const itemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: true,
    enum: ['Electronics', 'Accessories', 'Clothing', 'Documents', 'Keys', 'Pets', 'Other']
  },
  type: {
    type: String,
    required: true,
    enum: ['lost', 'found'] // Is this item lost by the user, or found by the user?
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  // GeoJSON Object for geographical location queries (if needed outside vector search)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point' 
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    addressText: {
      type: String,
      required: true
    }
  },
  imageUrl: {
    type: String,
    required: true // Hosted URL from Cloudinary
  },
  reporterId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Pending Claim', 'Resolved'],
    default: 'Active'
  },
  // The crucial vector embedding array for CLIP (512 dimensions)
  embedding: {
    type: [Number],
    required: true,
    validate: {
      validator: function(v) {
        return v.length === 512; // Xenova clip-vit-base-patch32 outputs 512 dims
      },
      message: 'Embedding must be an array of exactly 512 numbers'
    }
  }
}, {
  timestamps: true
});

// Create a 2dsphere index for location based queries
itemSchema.index({ location: '2dsphere' });
// Compound index for standard fast lookups
itemSchema.index({ type: 1, status: 1 });

/*
======================================================================
  MONGODB ATLAS $vectorSearch INDEX DEFINITION
======================================================================
  You MUST create this index manually in the MongoDB Atlas UI, 
  or via the Atlas Search API/CLI. It cannot be created directly 
  via Mongoose `schema.index()`.

  Name the index: `vector_index` (used in our controller)
  Database: `lost_and_found` (or your db name)
  Collection: `items`

  JSON Configuration:
  {
    "fields": [
      {
        "numDimensions": 512,
        "path": "embedding",
        "similarity": "cosine",
        "type": "vector"
      },
      {
        "path": "type",
        "type": "filter"
      },
      {
        "path": "status",
        "type": "filter"
      },
      {
        "path": "category",
        "type": "filter"
      }
    ]
  }
======================================================================
*/

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;

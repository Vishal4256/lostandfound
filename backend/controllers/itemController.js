const Item = require('../models/Item');
const { generateImageEmbedding } = require('../services/embeddingService');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Helper to upload buffer to Cloudinary
 */
const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: folder, resource_type: 'image' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

/**
 * Creates a new Lost or Found listing
 * Route: POST /api/items
 * Middleware required: multer (for req.file), auth (for req.user)
 */
exports.createListing = async (req, res) => {
  try {
    const { title, description, category, type, location, coordinates, addressText } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image is required' });
    }

    // 1. Process Image - Upload to Cloudinary
    // This runs asynchronously
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer, 'lost_and_found');
    const imageUrl = cloudinaryResult.secure_url;

    // 2. Generate Vector Embedding using local CLIP model
    // CPU-intensive operation, handled by @xenova/transformers
    const embedding = await generateImageEmbedding(req.file.buffer);

    // 3. Build flexible location object
    // Frontend may send a plain string (location) or structured data (coordinates + addressText)
    const locationData = coordinates
      ? { type: 'Point', coordinates: JSON.parse(coordinates), addressText: addressText || location }
      : { addressText: location || addressText || 'Unknown' };

    // 4. Create database entry
    const newItem = await Item.create({
      title,
      description: description || '',
      category,
      type, // 'lost' or 'found'
      location: locationData,
      imageUrl,
      reporterId: req.user._id, // Set by JWT auth middleware
      embedding
    });

    res.status(201).json({
      success: true,
      data: {
        _id: newItem._id,
        title: newItem.title,
        imageUrl: newItem.imageUrl,
        type: newItem.type
      }
    });

  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ success: false, message: 'Server Error processing listing' });
  }
};

/**
 * Searches for visual matches using Atlas Vector Search (RAG)
 * Route: POST /api/items/search
 * Middleware required: multer (for req.file query)
 */
exports.searchVectorMatches = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Query image is required for visual search' });
    }

    // 1. Generate embedding for the query image
    const queryEmbedding = await generateImageEmbedding(req.file.buffer);

    // Helper: cosine similarity between two vectors
    const cosineSimilarity = (a, b) => {
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < a.length; i++) {
        dot   += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
    };

    let results = [];

    // 2a. Try Atlas $vectorSearch first (requires vector_index in Atlas)
    try {
      const pipeline = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 150,
            limit: 20,
          }
        },
        {
          $project: {
            title: 1, description: 1, imageUrl: 1, category: 1,
            type: 1, date: 1, location: 1, status: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ];

      const atlasResults = await Item.aggregate(pipeline);

      if (atlasResults.length > 0) {
        results = atlasResults
          .map(m => ({ ...m, matchPercentage: Math.round(m.score * 100) }))
          .filter(m => m.matchPercentage >= 50) // 50% minimum for Atlas cosine
          .sort((a, b) => b.matchPercentage - a.matchPercentage);

        console.log(`Atlas vector search returned ${results.length} results`);
      }
    } catch (atlasErr) {
      console.warn('Atlas $vectorSearch unavailable, falling back to in-memory cosine similarity:', atlasErr.message);
    }

    // 2b. Fallback: load all items and compute cosine similarity in memory
    if (results.length === 0) {
      console.log('Running in-memory cosine similarity search...');
      const allItems = await Item.find({ embedding: { $exists: true, $not: { $size: 0 } } })
        .select('title description imageUrl category type date location status embedding')
        .lean();

      results = allItems
        .map(item => {
          const score = cosineSimilarity(queryEmbedding, item.embedding);
          return { ...item, score, matchPercentage: Math.round(Math.max(0, score) * 100) };
        })
        .filter(item => item.score > 0.3) // Minimum 30% similarity
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)
        .map(({ embedding, score, ...rest }) => rest); // Strip raw fields from response
    }

    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });

  } catch (error) {
    console.error('Error executing visual search:', error);
    res.status(500).json({ success: false, message: 'Server Error executing visual search' });
  }
};

const jwt = require('jsonwebtoken');
require('../models/User'); // Ensure User schema is registered for populate

const JWT_SECRET = process.env.JWT_SECRET || 'lostandfound_super_secret_key_change_in_prod';

exports.getAllItems = async (req, res) => {
  try {
    let filter = {};

    // Check if user requested their own items
    if (req.query.mine === 'true') {
      let userId = req.user?._id;
      if (!userId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        try {
          const token = req.headers.authorization.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          userId = decoded.id;
        } catch (e) {
          // invalid token
        }
      }

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required for my reports' });
      }
      filter.reporterId = userId;
    } else {
      if (req.query.category && req.query.category !== 'All') {
        filter.category = req.query.category;
      }
      if (req.query.type && req.query.type !== 'all') {
        filter.type = req.query.type;
      }
    }

    const items = await Item.find(filter)
      .populate('reporterId', 'name email avatar')
      .sort({ createdAt: -1, date: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ success: false, message: 'Server error fetching items' });
  }
};

/**
 * Gets a single item by its ID
 * Route: GET /api/items/:id
 */
exports.getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('reporterId', 'name email avatar');
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ success: false, message: 'Server error fetching item' });
  }
};

/**
 * Update item status (e.g. Active -> Resolved)
 * Route: PATCH /api/items/:id/status
 */
exports.updateItemStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['Active', 'Pending Claim', 'Resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status required (Active, Pending Claim, Resolved)' });
    }

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Ensure the requester is the reporter
    if (item.reporterId && item.reporterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the reporter can update status' });
    }

    item.status = status;
    await item.save();

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error updating item status:', error);
    res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};


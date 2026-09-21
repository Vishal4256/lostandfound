const mongoose = require('mongoose');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Conversation = require('../models/Conversation');
const { generateImageEmbedding } = require('../services/embeddingService');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary
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
 * Helper to escape regex special characters to prevent ReDoS / Syntax crashes
 */
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

const VALID_CATEGORIES = [
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
];

/**
 * Creates a new Lost or Found listing
 * Route: POST /api/items
 */
exports.createListing = async (req, res) => {
  let uploadedCloudinaryId = null;

  try {
    const { title, description, category, type, itemType, location, coordinates, addressText, date } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Item title is required' });
    }

    if (title.trim().length > 100) {
      return res.status(400).json({ success: false, message: 'Title cannot exceed 100 characters' });
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Please select a valid category from: ${VALID_CATEGORIES.join(', ')}`
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Item photo is required' });
    }

    const listingType = (itemType || type || 'lost').toLowerCase();
    if (!['lost', 'found'].includes(listingType)) {
      return res.status(400).json({ success: false, message: "Type must be either 'lost' or 'found'" });
    }

    // 1. Upload image to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer, 'lost_and_found');
    uploadedCloudinaryId = cloudinaryResult.public_id;
    const imageUrl = cloudinaryResult.secure_url;

    // 2. Generate local CLIP embedding (512 dimensions)
    const embedding = await generateImageEmbedding(req.file.buffer);
    if (!Array.isArray(embedding) || embedding.length !== 512) {
      throw new Error('Generated embedding must be exactly 512 dimensions');
    }

    // 3. Build location structure
    let locationData = { addressText: 'Unknown' };
    if (coordinates) {
      try {
        const parsed = typeof coordinates === 'string' ? JSON.parse(coordinates) : coordinates;
        locationData = {
          addressText: (addressText || location || 'Unknown').trim(),
          coordinates: parsed
        };
      } catch {
        locationData = { addressText: (addressText || location || 'Unknown').trim() };
      }
    } else if (location || addressText) {
      locationData = { addressText: (location || addressText).trim() };
    }

    // 4. Save item to database
    const newItem = await Item.create({
      title: title.trim(),
      description: (description || '').trim(),
      category,
      type: listingType,
      itemType: listingType,
      location: locationData,
      imageUrl,
      date: date ? new Date(date) : new Date(),
      reportedBy: req.user._id,
      reporterId: req.user._id,
      status: 'Active',
      embedding
    });

    const populatedItem = await Item.findById(newItem._id)
      .select('-embedding')
      .populate('reportedBy', 'name email avatar');

    res.status(201).json({
      success: true,
      data: populatedItem
    });
  } catch (error) {
    console.error('Error creating listing:', error);

    // Rollback uploaded Cloudinary image if creation failed
    if (uploadedCloudinaryId) {
      try {
        await cloudinary.uploader.destroy(uploadedCloudinaryId);
      } catch (cleanupErr) {
        console.warn('Failed to clean up Cloudinary image on error:', cleanupErr.message);
      }
    }

    res.status(500).json({ success: false, message: error.message || 'Server Error processing listing' });
  }
};

/**
 * Searches for visual matches using Atlas Vector Search or in-memory fallback
 * Route: POST /api/items/search
 */
exports.searchVectorMatches = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Query image is required for visual search' });
    }

    const { type, itemType, category, includeResolved } = req.query;

    // 1. Generate embedding for query image
    const queryEmbedding = await generateImageEmbedding(req.file.buffer);

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

    // 2a. Atlas $vectorSearch
    try {
      const pipeline = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 150,
            limit: 30,
          }
        },
        {
          $project: {
            title: 1, description: 1, imageUrl: 1, category: 1,
            type: 1, itemType: 1, date: 1, location: 1, status: 1, reportedBy: 1, reporterId: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ];

      const atlasResults = await Item.aggregate(pipeline);
      if (atlasResults.length > 0) {
        results = atlasResults
          .map(m => ({ ...m, matchPercentage: Math.round(m.score * 100) }))
          .filter(m => m.matchPercentage >= 40)
          .sort((a, b) => b.matchPercentage - a.matchPercentage);
      }
    } catch (atlasErr) {
      console.warn('Atlas $vectorSearch fallback to in-memory cosine search:', atlasErr.message);
    }

    // 2b. In-memory cosine search fallback
    if (results.length === 0) {
      const dbQuery = { embedding: { $exists: true, $not: { $size: 0 } } };

      const allItems = await Item.find(dbQuery)
        .select('title description imageUrl category type itemType date location status reportedBy reporterId embedding')
        .lean();

      results = allItems
        .map(item => {
          const score = cosineSimilarity(queryEmbedding, item.embedding);
          return { ...item, score, matchPercentage: Math.round(Math.max(0, score) * 100) };
        })
        .filter(item => item.score > 0.25)
        .sort((a, b) => b.score - a.score)
        .slice(0, 25)
        .map(({ embedding, score, ...rest }) => rest);
    }

    // Apply optional visual search filters
    if (type || itemType) {
      const filterType = (type || itemType).toLowerCase();
      if (filterType !== 'all') {
        results = results.filter(r => (r.type || r.itemType || '').toLowerCase() === filterType);
      }
    }

    if (category && category !== 'All') {
      results = results.filter(r => r.category === category);
    }

    if (includeResolved !== 'true') {
      results = results.filter(r => r.status !== 'Resolved');
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

/**
 * Get all items with hybrid filters, search query, and pagination
 * Route: GET /api/items
 */
exports.getAllItems = async (req, res) => {
  try {
    const { itemType, type, category, status, search, mine } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};

    // Filter by own items if requested
    if (mine === 'true' && req.user) {
      filter.$or = [
        { reportedBy: req.user._id },
        { reporterId: req.user._id }
      ];
    }

    // Filter by Type
    const filterType = itemType || type;
    if (filterType && filterType.toLowerCase() !== 'all') {
      const lower = filterType.toLowerCase();
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { type: lower },
          { itemType: lower }
        ]
      });
    }

    // Filter by Category
    if (category && category.toLowerCase() !== 'all') {
      filter.category = category;
    }

    // Filter by Status
    if (status && status.toLowerCase() !== 'all') {
      const clean = status.toLowerCase().replace(/_/g, ' ');
      if (clean === 'active') filter.status = 'Active';
      else if (clean === 'pending claim' || clean === 'pending') filter.status = 'Pending Claim';
      else if (clean === 'resolved') filter.status = 'Resolved';
      else filter.status = status;
    }

    // Keyword Search with regex escaping to prevent ReDoS
    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      const searchRegex = new RegExp(escaped, 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { 'location.addressText': searchRegex }
        ]
      });
    }

    const total = await Item.countDocuments(filter);
    const items = await Item.find(filter)
      .select('-embedding')
      .populate('reportedBy', 'name email avatar')
      .populate('reporterId', 'name email avatar')
      .sort({ createdAt: -1, date: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: items.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      data: items
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ success: false, message: 'Server error fetching items' });
  }
};

/**
 * Get items submitted by the currently logged-in user
 * Route: GET /api/items/my-items
 */
exports.getMyItems = async (req, res) => {
  try {
    const items = await Item.find({
      $or: [
        { reportedBy: req.user._id },
        { reporterId: req.user._id }
      ]
    })
      .select('-embedding')
      .populate('reportedBy', 'name email avatar')
      .populate('reporterId', 'name email avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Error fetching user items:', error);
    res.status(500).json({ success: false, message: 'Server error fetching your reported items' });
  }
};

/**
 * Gets a single item by its ID
 * Route: GET /api/items/:id
 */
exports.getItemById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid item ID format' });
    }

    const item = await Item.findById(id)
      .select('-embedding')
      .populate('reportedBy', 'name email avatar')
      .populate('reporterId', 'name email avatar');

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
 * Update item status manually (Reporter or Admin only)
 * Route: PATCH /api/items/:id/status
 */
exports.updateItemStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid item ID format' });
    }

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const authorId = (item.reportedBy || item.reporterId)?.toString();
    const isReporter = authorId === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isReporter && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only the item reporter or administrator can update status' });
    }

    item.status = status;
    await item.save();

    res.status(200).json({
      success: true,
      message: `Item status updated to ${item.status}`,
      data: item
    });
  } catch (error) {
    console.error('Error updating item status:', error);
    res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};

/**
 * Delete an item and its associated claims
 * Route: DELETE /api/items/:id
 */
exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid item ID format' });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const authorId = (item.reportedBy || item.reporterId)?.toString();
    const isReporter = authorId === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isReporter && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only the item reporter or administrator can delete this listing' });
    }

    await Claim.deleteMany({ item: id });
    await Conversation.deleteMany({ item: id });
    await Item.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Item and associated records deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ success: false, message: 'Server error deleting item' });
  }
};

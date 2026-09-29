const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const Item = require('../models/Item');
const User = require('../models/User');
const Claim = require('../models/Claim');
const Conversation = require('../models/Conversation');
const { generateImageEmbedding } = require('../services/embeddingService');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const JWT_SECRET = process.env.JWT_SECRET || 'lostandfound_super_secret_key_change_in_prod';

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

/**
 * Cosine similarity between two dense float vectors
 */
const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
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
  'Other',
  'Wallets & IDs',
  'Pets & Animals',
  'Keys & Access Cards',
  'Bags & Luggage',
  'Jewelry & Watches',
  'Documents & Portfolios',
  'Other Civic Item'
];

/**
 * Creates a new Lost or Found listing
 * Route: POST /api/items
 */
exports.createListing = async (req, res) => {
  let uploadedCloudinaryId = null;

  try {
    const {
      title,
      description,
      category,
      subCategory,
      type,
      itemType,
      location,
      coordinates,
      addressText,
      date,
      confidentialVerification,
      privateVerification,
      contactPreference,
      contactPref
    } = req.body;

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
    if (coordinates && coordinates !== 'null' && coordinates !== 'undefined') {
      try {
        const parsed = typeof coordinates === 'string' ? JSON.parse(coordinates) : coordinates;
        if (Array.isArray(parsed) && parsed.length === 2 && !isNaN(parsed[0]) && !isNaN(parsed[1])) {
          locationData = {
            addressText: (addressText || location || 'Unknown').trim(),
            coordinates: [parseFloat(parsed[0]), parseFloat(parsed[1])]
          };
        } else {
          locationData = { addressText: (addressText || location || 'Unknown').trim() };
        }
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
      subCategory: (subCategory || '').trim(),
      confidentialVerification: (confidentialVerification || privateVerification || '').trim(),
      contactPreference: (contactPreference || contactPref || 'chat'),
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

    // 5. Pre-match correlation: find potential matches from database
    let potentialMatches = [];
    try {
      const oppositeType = listingType === 'lost' ? 'found' : 'lost';
      const candidateItems = await Item.find({
        _id: { $ne: newItem._id },
        $or: [{ type: oppositeType }, { itemType: oppositeType }],
        status: 'Active',
        embedding: { $exists: true, $not: { $size: 0 } }
      }).select('title description imageUrl category type itemType date location status embedding').lean();

      potentialMatches = candidateItems
        .map(candidate => {
          const score = cosineSimilarity(embedding, candidate.embedding);
          return {
            ...candidate,
            score,
            matchPercentage: Math.round(Math.max(0, score) * 100)
          };
        })
        .filter(m => m.matchPercentage >= 40)
        .sort((a, b) => b.matchPercentage - a.matchPercentage)
        .slice(0, 5)
        .map(({ embedding, score, ...rest }) => rest);
    } catch (matchErr) {
      console.warn('Pre-match correlation error:', matchErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Listing published successfully',
      data: populatedItem,
      potentialMatches
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
    const { itemType, type, category, status, search, location, custody, inCustody, sort, mine } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
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

    // Filter by Custody
    const isCustodyOnly = custody === 'true' || inCustody === 'true';
    if (isCustodyOnly) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { type: 'found' },
          { itemType: 'found' }
        ],
        status: { $ne: 'Resolved' }
      });
    }

    // Filter by Category (with aliases for combined labels)
    if (category && category.toLowerCase() !== 'all') {
      const catTrim = category.trim();
      filter.$and = filter.$and || [];
      if (catTrim === 'Wallets' || catTrim === 'Keys' || catTrim.toLowerCase().includes('wallet') || catTrim.toLowerCase().includes('key')) {
        filter.$and.push({ category: { $in: ['Wallets', 'Keys'] } });
      } else if (catTrim === 'Documents' || catTrim === 'IDs' || catTrim.toLowerCase().includes('doc') || catTrim.toLowerCase().includes('id')) {
        filter.$and.push({ category: { $in: ['Documents', 'IDs'] } });
      } else if (catTrim === 'Bags' || catTrim === 'Accessories' || catTrim.toLowerCase().includes('bag')) {
        filter.$and.push({ category: { $in: ['Bags', 'Accessories', 'Clothing'] } });
      } else if (catTrim === 'Jewellery' || catTrim === 'Jewelry') {
        filter.$and.push({ category: { $in: ['Jewellery', 'Jewelry'] } });
      } else if (catTrim === 'Pets' || catTrim.toLowerCase().includes('pet') || catTrim.toLowerCase().includes('animal')) {
        filter.$and.push({ category: 'Pets' });
      } else {
        filter.$and.push({ category: catTrim });
      }
    }

    // Filter by Location / Civic Zone
    if (location && location.trim() && location.trim().toLowerCase() !== 'all') {
      const locEscaped = escapeRegex(location.trim());
      const locRegex = new RegExp(locEscaped, 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { 'location.addressText': locRegex },
          { 'location.name': locRegex },
          { 'location.address': locRegex },
          { 'location.city': locRegex },
          { 'location.district': locRegex }
        ]
      });
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
      const trimmed = search.trim();
      const escaped = escapeRegex(trimmed);
      const searchRegex = new RegExp(escaped, 'i');

      const orConditions = [
        { title: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { 'location.addressText': searchRegex },
        { 'location.name': searchRegex },
        { 'location.address': searchRegex },
        { 'location.city': searchRegex }
      ];

      // Support searching by Mongo ObjectId or Case ID suffix
      if (mongoose.isValidObjectId(trimmed)) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(trimmed) });
      } else {
        const hexOnly = trimmed.replace(/[^0-9a-fA-F]/g, '');
        if (hexOnly.length >= 4 && hexOnly.length <= 24) {
          orConditions.push({
            $expr: {
              $regexMatch: {
                input: { $toString: '$_id' },
                regex: hexOnly,
                options: 'i'
              }
            }
          });
        }
      }

      filter.$and = filter.$and || [];
      filter.$and.push({ $or: orConditions });
    }

    // Sort order
    let sortOptions = { createdAt: -1, date: -1 };
    if (sort === 'oldest') {
      sortOptions = { createdAt: 1, date: 1 };
    } else if (sort === 'title') {
      sortOptions = { title: 1 };
    }

    const total = await Item.countDocuments(filter);
    const items = await Item.find(filter)
      .select('-embedding')
      .populate('reportedBy', 'name email avatar')
      .populate('reporterId', 'name email avatar')
      .sort(sortOptions)
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
 * Reverse geocode latitude and longitude into clean human-readable local area/city
 * Route: GET /api/items/reverse-geocode?lat=...&lng=...
 */
exports.reverseGeocode = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat || req.query.latitude);
    const lon = parseFloat(req.query.lng || req.query.lon || req.query.longitude);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude (-90 to 90) and longitude (-180 to 180) required'
      });
    }

    let localArea = '';

    // Primary: BigDataCloud reverse geocoding (fast and focused on locality/city/state)
    try {
      const bdcRes = await axios.get('https://api.bigdatacloud.net/data/reverse-geocode-client', {
        params: {
          latitude: lat,
          longitude: lon,
          localityLanguage: 'en'
        },
        timeout: 5000
      });

      if (bdcRes.data) {
        const locality = bdcRes.data.locality || bdcRes.data.city;
        const region = bdcRes.data.principalSubdivision;
        if (locality && region) {
          localArea = locality.toLowerCase() !== region.toLowerCase() ? `${locality}, ${region}` : locality;
        } else if (locality) {
          localArea = locality;
        } else if (region) {
          localArea = region;
        }
      }
    } catch (bdcErr) {
      console.warn('BigDataCloud reverse geocoding warning:', bdcErr.message);
    }

    // Secondary fallback: OpenStreetMap Nominatim structured locality components
    if (!localArea) {
      try {
        const nomRes = await axios.get('https://nominatim.openstreetmap.org/reverse', {
          params: {
            format: 'jsonv2',
            lat,
            lon,
            addressdetails: 1,
            zoom: 14 // city / town level
          },
          headers: {
            'User-Agent': 'HavenFind-CivicRegistry/1.0 (contact@havenfind.org)'
          },
          timeout: 5000
        });

        if (nomRes.data && nomRes.data.address) {
          const addr = nomRes.data.address;
          const locality =
            addr.suburb ||
            addr.neighbourhood ||
            addr.city_district ||
            addr.village ||
            addr.town ||
            addr.city ||
            addr.municipality ||
            (addr.county ? addr.county.replace(/\s+(Tahsil|Tehsil|Taluk|District)$/i, '') : null) ||
            addr.state_district;

          const broaderCity =
            addr.city ||
            addr.town ||
            addr.municipality ||
            (addr.county ? addr.county.replace(/\s+(Tahsil|Tehsil|Taluk|District)$/i, '') : null);

          const state = addr.state || addr.state_district;

          const parts = [];
          if (locality && broaderCity && locality.toLowerCase() !== broaderCity.toLowerCase()) {
            parts.push(locality, broaderCity);
          } else if (locality) {
            parts.push(locality);
          } else if (broaderCity) {
            parts.push(broaderCity);
          }

          if (state && !parts.some(p => p.toLowerCase() === state.toLowerCase())) {
            parts.push(state);
          }

          if (parts.length > 0) {
            localArea = parts.join(', ');
          }
        }
      } catch (nomErr) {
        console.warn('Nominatim reverse geocoding warning:', nomErr.message);
      }
    }

    if (!localArea) {
      return res.status(502).json({
        success: false,
        message: 'Unable to determine local area from the provided coordinates'
      });
    }

    res.status(200).json({
      success: true,
      address: localArea,
      localArea,
      coordinates: [lon, lat] // [longitude, latitude] GeoJSON order
    });
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    res.status(500).json({ success: false, message: 'Server error during reverse geocoding' });
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

    const itemObj = item.toObject();

    // Check if requester is authorized reporter or admin
    let requesterId = null;
    let isAdmin = false;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        requesterId = decoded.id;
        const user = await User.findById(decoded.id);
        if (user && user.role === 'admin') isAdmin = true;
      } catch {}
    }

    const reporterId = (item.reportedBy?._id || item.reportedBy || item.reporterId?._id || item.reporterId)?.toString();
    const isReporterOrAdmin = requesterId && (requesterId.toString() === reporterId || isAdmin);

    if (isReporterOrAdmin) {
      const rawWithPrivate = await Item.findById(id).select('+confidentialVerification');
      if (rawWithPrivate && rawWithPrivate.confidentialVerification) {
        itemObj.confidentialVerification = rawWithPrivate.confidentialVerification;
      }
    }

    res.status(200).json({ success: true, data: itemObj });
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

    if (!status || typeof status !== 'string') {
      return res.status(400).json({ success: false, message: 'Valid status string is required' });
    }

    const clean = status.toLowerCase().trim().replace(/_/g, ' ');
    let normalizedStatus;
    if (clean === 'active') normalizedStatus = 'Active';
    else if (clean === 'pending claim' || clean === 'pending') normalizedStatus = 'Pending Claim';
    else if (clean === 'resolved') normalizedStatus = 'Resolved';
    else {
      return res.status(400).json({
        success: false,
        message: "Status must be 'Active', 'Pending Claim', or 'Resolved'"
      });
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

    item.status = normalizedStatus;
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

/**
 * Get registry statistics
 * Route: GET /api/items/stats
 */
exports.getItemStats = async (req, res) => {
  try {
    const total = await Item.countDocuments({});
    const active = await Item.countDocuments({ status: 'Active' });
    const inCustody = await Item.countDocuments({
      $or: [{ type: 'found' }, { itemType: 'found' }],
      status: { $ne: 'Resolved' }
    });
    const resolved = await Item.countDocuments({ status: 'Resolved' });

    res.status(200).json({
      success: true,
      stats: {
        total,
        active,
        inCustody,
        resolved
      }
    });
  } catch (error) {
    console.error('Error fetching item stats:', error);
    res.status(500).json({ success: false, message: 'Server error fetching statistics' });
  }
};


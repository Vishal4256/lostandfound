const Item = require('../models/Item');
const { generateImageEmbedding } = require('../services/embeddingService');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

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
    const { title, description, category, type, coordinates, addressText } = req.body;
    
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

    // 3. Create database entry
    const newItem = await Item.create({
      title,
      description,
      category,
      type, // 'lost' or 'found'
      location: {
        type: 'Point',
        coordinates: coordinates ? JSON.parse(coordinates) : [0, 0], // Expecting stringified array '[lng, lat]'
        addressText
      },
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
    // If I lost an item, I search 'found' items. If I found an item, I search 'lost' items.
    const searchAgainstType = req.body.searchType === 'lost' ? 'found' : 'lost';
    const filterCategory = req.body.category;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Query image is required for visual search' });
    }

    // 1. Generate embedding for the query image
    const queryEmbedding = await generateImageEmbedding(req.file.buffer);

    // 2. Build the $vectorSearch aggregation pipeline
    // Requires MongoDB Atlas cluster >= M0 with 'vector_index' created
    const vectorSearchStage = {
      $vectorSearch: {
        index: 'vector_index', // Name of the Atlas Vector Index
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: 100, // HNSW candidate window size
        limit: 10,          // Return top 10 matches
        filter: {
          type: searchAgainstType,
          status: 'Active'
        }
      }
    };

    // Apply optional category filter
    if (filterCategory && filterCategory !== 'All') {
      vectorSearchStage.$vectorSearch.filter.category = filterCategory;
    }

    const pipeline = [
      vectorSearchStage,
      {
        // Project out the embedding array and calculate a normalized score
        $project: {
          title: 1,
          description: 1,
          imageUrl: 1,
          category: 1,
          date: 1,
          location: 1,
          status: 1,
          // Atlas Vector Search score is exposed via meta
          score: { $meta: 'vectorSearchScore' }
        }
      },
      {
        // Only return matches with high confidence (e.g., score >= 0.85)
        $match: {
          score: { $gte: 0.85 } 
        }
      }
    ];

    // Execute aggregation
    const matches = await Item.aggregate(pipeline);

    // Format the results: Convert cosine distance score to a clean UI percentage
    const formattedMatches = matches.map(match => ({
      ...match,
      matchPercentage: Math.round(match.score * 100)
    }));

    res.status(200).json({
      success: true,
      count: formattedMatches.length,
      data: formattedMatches
    });

};

exports.getAllItems = async (req, res) => {
  try {
    const items = await Item.find().sort({ date: -1 }).limit(20);
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

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const { createListing, searchVectorMatches, getAllItems, getItemById } = require('./controllers/itemController');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json());

// Set up Multer for handling file uploads in-memory
const upload = multer({ storage: multer.memoryStorage() });

// Auth placeholder middleware (since createListing requires req.user)
const mockAuth = (req, res, next) => {
  req.user = { _id: new mongoose.Types.ObjectId() };
  next();
};

// Routes
// --- ROUTES ---
app.get('/api/items', getAllItems);
app.get('/api/items/:id', getItemById);
app.post('/api/items', upload.single('image'), mockAuth, createListing);
app.post('/api/items/search', upload.single('image'), searchVectorMatches);

const { generateImageEmbedding } = require('./services/embeddingService');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(async () => {
  console.log('Connected to MongoDB Atlas');

  // ── Index migration ──────────────────────────────────────────────
  // Drop the legacy 2dsphere index on `location` if it exists.
  // It was created by the old schema and rejects plain-text location
  // objects like { addressText: "NY" }.
  try {
    const Item = require('./models/Item');
    const indexes = await Item.collection.indexes();
    const geoIndex = indexes.find(idx => idx.key && idx.key['location'] === '2dsphere');
    if (geoIndex) {
      await Item.collection.dropIndex(geoIndex.name);
      console.log('✅ Dropped legacy location_2dsphere index');
    }
  } catch (err) {
    console.warn('Index migration skipped:', err.message);
  }
  // ────────────────────────────────────────────────────────────────

  // Warm up CLIP model during server initialization
  (async () => {
    try {
      console.log('Pre-warming CLIP Model into memory...');
      await generateImageEmbedding(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
      console.log('CLIP Model pre-warmed successfully!');
    } catch (err) {
      console.warn('Model pre-warm skipped or failed, will load on first request:', err.message);
    }
  })();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})
.catch(err => {
  console.error('Failed to connect to MongoDB', err);
});

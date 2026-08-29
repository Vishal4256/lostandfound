require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const { createListing, searchVectorMatches, getAllItems } = require('./controllers/itemController');

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
app.post('/api/items', upload.single('image'), createListing);
app.post('/api/items/search', upload.single('image'), searchVectorMatches);

const { generateImageEmbedding } = require('./services/embeddingService');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log('Connected to MongoDB Atlas');
  
  // Warm up CLIP model during server initialization
  (async () => {
    try {
      console.log('Pre-warming CLIP Model into memory...');
      // Pass a dummy 1x1 buffer to load model weights
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

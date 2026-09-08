require('dotenv').config();
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const { Server } = require('socket.io');

const authMiddleware = require('./middleware/auth');
const authController = require('./controllers/authController');
const chatController = require('./controllers/chatController');
const {
  createListing,
  searchVectorMatches,
  getAllItems,
  getItemById,
  updateItemStatus
} = require('./controllers/itemController');
const { generateImageEmbedding } = require('./services/embeddingService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'], credentials: true }));
app.use(express.json());

// Pass Socket.IO instance to all route handlers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Multer for memory upload
const upload = multer({ storage: multer.memoryStorage() });

// ── Auth Routes ──────────────────────────────────────────────
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', authMiddleware, authController.getMe);

// ── Item Routes ──────────────────────────────────────────────
app.get('/api/items', getAllItems);
app.post('/api/items/search', upload.single('image'), searchVectorMatches);
app.post('/api/items', upload.single('image'), authMiddleware, createListing);
app.get('/api/items/:id', getItemById);
app.patch('/api/items/:id/status', authMiddleware, updateItemStatus);

// ── Chat Routes ──────────────────────────────────────────────
app.get('/api/chat/conversations', authMiddleware, chatController.getUserConversations);
app.post('/api/chat/conversations', authMiddleware, chatController.getOrCreateConversation);
app.get('/api/chat/conversations/:id/messages', authMiddleware, chatController.getMessages);
app.post('/api/chat/conversations/:id/messages', authMiddleware, chatController.sendMessage);

// ── Socket.IO Real-Time Messaging ────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // User joins their personal room for direct notifications
  socket.on('join_user_room', (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`👤 User ${userId} joined their notification room`);
    }
  });

  // User joins a specific conversation chat room
  socket.on('join_conversation', (conversationId) => {
    if (conversationId) {
      socket.join(conversationId);
      console.log(`💬 Socket ${socket.id} joined conversation: ${conversationId}`);
    }
  });

  // User leaves a conversation room
  socket.on('leave_conversation', (conversationId) => {
    if (conversationId) {
      socket.leave(conversationId);
      console.log(`🚪 Socket ${socket.id} left conversation: ${conversationId}`);
    }
  });

  // Typing status
  socket.on('typing', ({ conversationId, userName, isTyping }) => {
    if (conversationId) {
      socket.to(conversationId).emit('user_typing', { userName, isTyping });
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// ── MongoDB Connection & Model Pre-warming ───────────────────
mongoose.connect(process.env.MONGO_URI)
.then(async () => {
  console.log('Connected to MongoDB Atlas');

  // Drop stale 2dsphere index if lingering
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

  // Pre-load CLIP model using a real image
  (async () => {
    try {
      console.log('Pre-warming CLIP model…');
      const https = require('https');
      const buf = await new Promise((resolve, reject) => {
        https.get('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=64&q=50', res => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        });
      });
      await generateImageEmbedding(buf);
      console.log('✅ CLIP model ready');
    } catch (err) {
      console.warn('Pre-warm warning (will load on demand):', err.message);
    }
  })();

  server.listen(PORT, () => {
    console.log(`🚀 Server with Socket.IO running on port ${PORT}`);
  });
})
.catch(err => {
  console.error('Failed to connect to MongoDB', err);
});

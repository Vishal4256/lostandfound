require('dotenv').config();
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const claimRoutes = require('./routes/claimRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { generateImageEmbedding } = require('./services/embeddingService');

const app = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'lostandfound_super_secret_key_change_in_prod';
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(s => s.trim()) : [])
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

// Attach Socket.IO instance to all route handlers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/chat', chatRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404 Handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ── Socket.IO Authentication & Real-Time Messaging ───────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
  if (!token) {
    socket.userId = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    socket.userId = null;
    next();
  }
});

io.on('connection', (socket) => {
  // Join private notification room (only for user's own ID)
  socket.on('join_user_room', (userId) => {
    if (socket.userId && socket.userId.toString() === userId?.toString()) {
      socket.join(`user_${userId}`);
    }
  });

  // Join specific conversation room with authorization check
  socket.on('join_conversation', async (conversationId) => {
    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return;
    if (!socket.userId) return;

    try {
      const Conversation = require('./models/Conversation');
      const conv = await Conversation.findById(conversationId);
      if (conv && conv.participants.some(p => p.toString() === socket.userId.toString())) {
        socket.join(conversationId);
      }
    } catch (err) {
      console.error('Socket room join error:', err.message);
    }
  });

  // Leave conversation room
  socket.on('leave_conversation', (conversationId) => {
    if (conversationId) {
      socket.leave(conversationId);
    }
  });

  // Typing status broadcast
  socket.on('typing', ({ conversationId, userName, isTyping }) => {
    if (conversationId && socket.rooms.has(conversationId)) {
      socket.to(conversationId).emit('user_typing', { userName, isTyping });
    }
  });

  socket.on('disconnect', () => {});
});

// ── MongoDB Connection & CLIP Model Pre-warming ──────────────
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

  // Pre-warm local CLIP model
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
    console.log(`🚀 Server running on port ${PORT}`);
  });
})
.catch(err => {
  console.error('Failed to connect to MongoDB', err);
});

module.exports = { app, server };

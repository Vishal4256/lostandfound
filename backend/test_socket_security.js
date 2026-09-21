/**
 * Socket.IO Security & Handshake Authorization Audit
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require('../frontend/node_modules/socket.io-client');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Item = require('./models/Item');

const JWT_SECRET = process.env.JWT_SECRET || 'lostandfound_super_secret_key_change_in_prod';
const PORT = 5097;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Mount exact socket authentication logic from server.js
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
  socket.on('join_user_room', (userId) => {
    if (socket.userId && socket.userId.toString() === userId?.toString()) {
      socket.join(`user_${userId}`);
    }
  });

  socket.on('join_conversation', async (conversationId, ack) => {
    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
      if (ack) ack({ success: false, message: 'Invalid ID' });
      return;
    }
    if (!socket.userId) {
      if (ack) ack({ success: false, message: 'Unauthenticated' });
      return;
    }

    try {
      const conv = await Conversation.findById(conversationId);
      if (conv && conv.participants.some(p => p.toString() === socket.userId.toString())) {
        socket.join(conversationId);
        if (ack) ack({ success: true, joined: true });
      } else {
        if (ack) ack({ success: false, message: 'Forbidden' });
      }
    } catch (err) {
      if (ack) ack({ success: false, message: err.message });
    }
  });
});

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  await new Promise(r => server.listen(PORT, r));

  console.log('\n── RUNNING SOCKET.IO AUTHORIZATION AUDIT ──');

  // Create test participants and conversation
  const userA = await User.create({ name: 'Socket A', email: `sockA_${Date.now()}@test.com`, passwordHash: 'hash123' });
  const userB = await User.create({ name: 'Socket B', email: `sockB_${Date.now()}@test.com`, passwordHash: 'hash123' });
  const userAttacker = await User.create({ name: 'Attacker', email: `attacker_${Date.now()}@test.com`, passwordHash: 'hash123' });

  const item = await Item.create({
    title: 'Socket Test Item',
    category: 'Keys',
    type: 'lost',
    imageUrl: 'https://example.com/test.jpg',
    reportedBy: userA._id,
    status: 'Active',
    embedding: new Array(512).fill(0.01)
  });

  const conversation = await Conversation.create({
    item: item._id,
    participants: [userA._id, userB._id],
    lastMessage: 'Hello'
  });

  const tokenA = jwt.sign({ id: userA._id }, JWT_SECRET);
  const tokenAttacker = jwt.sign({ id: userAttacker._id }, JWT_SECRET);

  // 1. Connect without token
  const unauthClient = ioClient(`http://localhost:${PORT}`);
  await new Promise(r => unauthClient.on('connect', r));
  console.log('  ✅ Unauthenticated client connected anonymously');

  const joinAttemptUnauth = await new Promise(resolve => {
    unauthClient.emit('join_conversation', conversation._id.toString(), resolve);
  });
  if (!joinAttemptUnauth.success && joinAttemptUnauth.message === 'Unauthenticated') {
    console.log('  ✅ Anonymous socket blocked from joining private conversation room');
  } else {
    throw new Error('Unauthenticated socket joined room');
  }
  unauthClient.disconnect();

  // 2. Connect with Attacker token and attempt joining User A & B conversation
  const attackerClient = ioClient(`http://localhost:${PORT}`, { auth: { token: tokenAttacker } });
  await new Promise(r => attackerClient.on('connect', r));

  const joinAttemptAttacker = await new Promise(resolve => {
    attackerClient.emit('join_conversation', conversation._id.toString(), resolve);
  });
  if (!joinAttemptAttacker.success && joinAttemptAttacker.message === 'Forbidden') {
    console.log('  ✅ Attacker socket blocked from joining User A & B conversation room (Forbidden)');
  } else {
    throw new Error('Attacker socket joined private room!');
  }
  attackerClient.disconnect();

  // 3. Connect with legitimate User A token and join conversation
  const clientA = ioClient(`http://localhost:${PORT}`, { auth: { token: tokenA } });
  await new Promise(r => clientA.on('connect', r));

  const joinAttemptA = await new Promise(resolve => {
    clientA.emit('join_conversation', conversation._id.toString(), resolve);
  });
  if (joinAttemptA.success && joinAttemptA.joined === true) {
    console.log('  ✅ Authorized participant User A successfully joined conversation room');
  } else {
    throw new Error('Legitimate user failed to join room');
  }
  clientA.disconnect();

  // Clean up
  await User.deleteMany({ _id: { $in: [userA._id, userB._id, userAttacker._id] } });
  await Item.findByIdAndDelete(item._id);
  await Conversation.findByIdAndDelete(conversation._id);

  server.close();
  await mongoose.disconnect();
  console.log('\nAll Socket.IO security tests passed cleanly!\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Socket test error:', err);
  if (server) server.close();
  process.exit(1);
});

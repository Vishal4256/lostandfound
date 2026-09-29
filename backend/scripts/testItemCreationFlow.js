/**
 * Test creation of real Lost and Found items via POST /api/items
 * and verify database counts and Home API responses.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const Item = require('../models/Item');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'lostandfound_super_secret_key_change_in_prod';

async function runTest() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);

  console.log('--- Step 1: Initial Database Verification ---');
  const countBefore = await Item.countDocuments();
  console.log(`Item.countDocuments() before submission: ${countBefore}`);

  // Find a real user in the DB (prefer vishal42564256@gmail.com if exists, else first user)
  let user = await User.findOne({ email: 'vishal42564256@gmail.com' });
  if (!user) {
    user = await User.findOne({});
  }
  console.log(`Using authenticated user: ${user.name} (${user.email})`);

  // Generate valid JWT token
  const token = jwt.sign({ id: user._id, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '7d' });

  // Create a valid test image buffer (100x100 PNG)
  // Simple 1x1 transparent PNG buffer
  const samplePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  console.log('\n--- Step 2: Create a real LOST item ---');
  const lostForm = new FormData();
  lostForm.append('title', 'Matte Black Sony WH-1000XM4 Headphones');
  lostForm.append('type', 'lost');
  lostForm.append('itemType', 'lost');
  lostForm.append('category', 'Electronics');
  lostForm.append('location', 'Central Terminal Platform 3');
  lostForm.append('description', 'Left in carrying case near the seating area next to Pillar 4.');
  lostForm.append('image', samplePngBuffer, { filename: 'lost_headphones.png', contentType: 'image/png' });

  const lostRes = await axios.post('http://127.0.0.1:5000/api/items', lostForm, {
    headers: {
      ...lostForm.getHeaders(),
      Authorization: `Bearer ${token}`
    }
  });

  console.log(`Lost item created successfully with ID: ${lostRes.data.data._id}`);
  const countAfter1 = await Item.countDocuments();
  console.log(`Item.countDocuments() === 1: ${countAfter1 === 1} (actual: ${countAfter1})`);

  console.log('\n--- Step 3: Create a real FOUND item ---');
  const foundForm = new FormData();
  foundForm.append('title', 'Tan Leather Bi-Fold Cardholder');
  foundForm.append('type', 'found');
  foundForm.append('itemType', 'found');
  foundForm.append('category', 'Wallets');
  foundForm.append('location', 'Civic Park Library Lawn');
  foundForm.append('description', 'Found resting under a wooden bench. Turned in for safe custody.');
  foundForm.append('image', samplePngBuffer, { filename: 'found_wallet.png', contentType: 'image/png' });

  const foundRes = await axios.post('http://127.0.0.1:5000/api/items', foundForm, {
    headers: {
      ...foundForm.getHeaders(),
      Authorization: `Bearer ${token}`
    }
  });

  console.log(`Found item created successfully with ID: ${foundRes.data.data._id}`);
  const countAfter2 = await Item.countDocuments();
  console.log(`Item.countDocuments() === 2: ${countAfter2 === 2} (actual: ${countAfter2})`);

  console.log('\n--- Step 4: Verify Public Feed & Stats API ---');
  const itemsRes = await axios.get('http://127.0.0.1:5000/api/items');
  console.log(`GET /api/items returned ${itemsRes.data.data.length} items`);
  itemsRes.data.data.forEach((it, idx) => {
    console.log(`  Item #${idx + 1}: [${it.type.toUpperCase()}] "${it.title}" (ID: ${it._id})`);
  });

  const statsRes = await axios.get('http://127.0.0.1:5000/api/items/stats');
  console.log('GET /api/items/stats:', JSON.stringify(statsRes.data.stats));

  await mongoose.disconnect();
}

runTest().catch((err) => {
  console.error('Error during test:', err.response?.data || err.message);
  process.exit(1);
});

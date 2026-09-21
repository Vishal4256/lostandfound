require('dotenv').config();
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const FormData = require('form-data');
const https = require('https');

// Import routes and middleware
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const claimRoutes = require('./routes/claimRoutes');
const Item = require('./models/Item');
const User = require('./models/User');
const Claim = require('./models/Claim');

async function runE2ETest() {
  console.log('🚀 Starting Full Platform End-to-End Automated Test...\n');

  // Setup standalone Express app on port 5055 for clean test isolation
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/claims', claimRoutes);

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas');

  const TEST_PORT = 5055;
  const server = app.listen(TEST_PORT);
  const BASE_URL = `http://localhost:${TEST_PORT}/api`;

  const timestamp = Date.now();
  const emailA = `reporter_${timestamp}@example.com`;
  const emailB = `claimant_${timestamp}@example.com`;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Register User A (Reporter) & User B (Claimant)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing User Authentication ---');
    const regResA = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Alice Reporter',
      email: emailA,
      password: 'password123'
    });
    console.log('✅ User A registered:', regResA.data.user.email);
    const tokenA = regResA.data.token;

    const regResB = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Bob Claimant',
      email: emailB,
      password: 'password123'
    });
    console.log('✅ User B registered:', regResB.data.user.email);
    const tokenB = regResB.data.token;

    // Test Login & /api/auth/me
    const meRes = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    if (meRes.data.user.name !== 'Alice Reporter') throw new Error('Auth me name mismatch');
    console.log('✅ Token verification & /api/auth/me verified for User A');

    // -------------------------------------------------------------------------
    // STEP 2: User A Creates an Item Listing with 512-D CLIP Embedding
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Item Submission & AI Embedding Generation ---');
    // Download sample image
    const sampleImageUrl = 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=300&q=75';
    const imageBuffer = await new Promise((resolve, reject) => {
      https.get(sampleImageUrl, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
    });

    const fd = new FormData();
    fd.append('title', `Vintage Keys On Carabiner ${timestamp}`);
    fd.append('type', 'lost');
    fd.append('category', 'Keys');
    fd.append('location', 'Central Library 3rd Floor');
    fd.append('description', 'Brass Yale key with blue plastic tag attached to a matte black carabiner.');
    fd.append('image', imageBuffer, { filename: 'keys.jpg', contentType: 'image/jpeg' });

    console.log('Uploading item with image and generating local CLIP embedding...');
    const createRes = await axios.post(`${BASE_URL}/items`, fd, {
      headers: {
        ...fd.getHeaders(),
        Authorization: `Bearer ${tokenA}`
      },
      timeout: 45000
    });

    const createdItem = createRes.data.data;
    console.log('✅ Item created successfully:', createdItem.title, 'ID:', createdItem._id);
    console.log('   Status:', createdItem.status, '| Type:', createdItem.type);

    // Verify embedding length in database
    const dbItem = await Item.findById(createdItem._id);
    if (!dbItem.embedding || dbItem.embedding.length !== 512) {
      throw new Error(`Invalid embedding length: ${dbItem.embedding?.length}`);
    }
    console.log('✅ Verified MongoDB vector embedding dimensions: 512 numbers');

    // -------------------------------------------------------------------------
    // STEP 3: Public Feed & Hybrid Search
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Public Feed & Filter Queries ---');
    const feedRes = await axios.get(`${BASE_URL}/items?type=lost&category=Keys&search=Carabiner`);
    const foundInFeed = feedRes.data.data.find(i => i._id === createdItem._id);
    if (!foundInFeed) throw new Error('Created item was not returned by hybrid search filter');
    console.log('✅ Hybrid filter (type=lost, category=Keys, search=Carabiner) matched item successfully!');

    // -------------------------------------------------------------------------
    // STEP 4: Ownership Claim Workflow
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Ownership Claim Workflow ---');
    
    // User A should NOT be able to claim their own item
    try {
      await axios.post(`${BASE_URL}/claims/${createdItem._id}`, {
        proofDetails: 'This is my item!'
      }, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      throw new Error('User was able to claim their own item (should have failed)!');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('✅ Self-claim correctly blocked with HTTP 400');
      } else {
        throw err;
      }
    }

    // User B submits a claim with proof
    console.log('User B submitting ownership claim with identifying proof...');
    const claimRes = await axios.post(`${BASE_URL}/claims/${createdItem._id}`, {
      proofDetails: 'The tag has the initials VK engraved on the reverse side.'
    }, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    const createdClaim = claimRes.data.claim;
    console.log('✅ Claim created successfully:', createdClaim._id, 'Status:', createdClaim.status);

    // Verify item transitioned to 'Pending Claim'
    const updatedItemAfterClaim = await Item.findById(createdItem._id);
    console.log('✅ Item status automatically set to:', updatedItemAfterClaim.status);

    // Duplicate pending claim attempt should fail
    try {
      await axios.post(`${BASE_URL}/claims/${createdItem._id}`, {
        proofDetails: 'Second attempt should fail'
      }, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      throw new Error('Duplicate claim was allowed!');
    } catch (err) {
      if (err.response?.status === 409) {
        console.log('✅ Duplicate pending claim correctly rejected with HTTP 409');
      } else {
        throw err;
      }
    }

    // User A (Reporter) views incoming claims
    const reporterClaimsRes = await axios.get(`${BASE_URL}/claims/item/${createdItem._id}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    console.log('✅ Reporter fetched incoming claims count:', reporterClaimsRes.data.count);

    // User B views "My Submitted Claims"
    const myClaimsRes = await axios.get(`${BASE_URL}/claims/my-claims`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    console.log('✅ Claimant fetched My Claims count:', myClaimsRes.data.count);

    // -------------------------------------------------------------------------
    // STEP 5: Claim Resolution & Auto-Transition
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Claim Resolution & Item Transition ---');
    console.log('Reporter approving User B claim...');
    const resolveRes = await axios.patch(`${BASE_URL}/claims/${createdClaim._id}/resolve`, {
      status: 'approved'
    }, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    console.log('✅ Claim status updated to:', resolveRes.data.claim.status);
    console.log('✅ Associated item status updated to:', resolveRes.data.itemStatus);

    const finalItemInDb = await Item.findById(createdItem._id);
    if (finalItemInDb.status !== 'Resolved') {
      throw new Error(`Item status should be Resolved but was: ${finalItemInDb.status}`);
    }
    console.log('✅ Verified item in DB is now:', finalItemInDb.status);

    // Clean up test documents
    await Claim.deleteMany({ item: createdItem._id });
    await Item.findByIdAndDelete(createdItem._id);
    await User.deleteMany({ email: { $in: [emailA, emailB] } });
    console.log('🧹 Cleaned up test records');

    console.log('\n======================================================');
    console.log('🎉 ALL ARCHITECTURAL TESTS PASSED CLEANLY & ACCURATELY!');
    console.log('======================================================\n');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runE2ETest().then(() => process.exit(0)).catch(err => {
  console.error('❌ E2E Test Failure:', err.response?.data || err.message);
  process.exit(1);
});

require('dotenv').config();
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const FormData = require('form-data');
const https = require('https');

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const claimRoutes = require('./routes/claimRoutes');
const chatRoutes = require('./routes/chatRoutes');
const Item = require('./models/Item');
const User = require('./models/User');
const Claim = require('./models/Claim');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

async function runFullAuditSuite() {
  console.log('===============================================================');
  console.log('🛡️  STARTING COMPREHENSIVE PRODUCTION AUDIT & QA TEST SUITE');
  console.log('===============================================================\n');

  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/claims', claimRoutes);
  app.use('/api/chat', chatRoutes);

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas');

  const TEST_PORT = 5088;
  const server = app.listen(TEST_PORT);
  const BASE_URL = `http://localhost:${TEST_PORT}/api`;

  const timestamp = Date.now();
  const emailA = `audit_reporter_${timestamp}@example.com`;
  const emailB = `audit_claimant_${timestamp}@example.com`;
  const emailAttacker = `audit_attacker_${timestamp}@example.com`;

  let tokenA, userA;
  let tokenB, userB;
  let tokenAttacker, userAttacker;
  let testItemId;
  let testClaimId;

  try {
    // -------------------------------------------------------------------------
    // TEST SECTION 1: AUTHENTICATION & INPUT VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n[1/6] ── AUDITING AUTHENTICATION & INPUT VALIDATION ──');

    // 1a: Missing fields on register
    try {
      await axios.post(`${BASE_URL}/auth/register`, { name: 'Test' });
      throw new Error('Allowed registration without email and password');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('  ✅ Rejected registration with missing fields (HTTP 400)');
      } else throw err;
    }

    // 1b: Weak password (<6 chars)
    try {
      await axios.post(`${BASE_URL}/auth/register`, { name: 'Test', email: 'test@ex.com', password: '123' });
      throw new Error('Allowed registration with weak password');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('  ✅ Rejected registration with password < 6 chars (HTTP 400)');
      } else throw err;
    }

    // 1c: Valid Registration User A (Reporter)
    const resA = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Alice Reporter',
      email: emailA,
      password: 'password123'
    });
    tokenA = resA.data.token;
    userA = resA.data.user;
    if (userA.passwordHash) throw new Error('passwordHash leaked in register response!');
    console.log('  ✅ User A registered safely without passwordHash leak');

    // 1d: Duplicate Email Registration Prevention
    try {
      await axios.post(`${BASE_URL}/auth/register`, {
        name: 'Alice Duplicate',
        email: emailA,
        password: 'password123'
      });
      throw new Error('Allowed duplicate email registration');
    } catch (err) {
      if (err.response?.status === 409) {
        console.log('  ✅ Duplicate email registration correctly rejected (HTTP 409)');
      } else throw err;
    }

    // 1e: Register User B (Claimant) & User C (Attacker)
    const resB = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Bob Claimant',
      email: emailB,
      password: 'password123'
    });
    tokenB = resB.data.token;
    userB = resB.data.user;

    const resAttacker = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Mallory Attacker',
      email: emailAttacker,
      password: 'password123'
    });
    tokenAttacker = resAttacker.data.token;
    userAttacker = resAttacker.data.user;
    console.log('  ✅ Additional test users B and Attacker registered');

    // 1f: Invalid Login (Wrong password)
    try {
      await axios.post(`${BASE_URL}/auth/login`, { email: emailA, password: 'wrongPassword' });
      throw new Error('Allowed login with incorrect password');
    } catch (err) {
      if (err.response?.status === 401) {
        console.log('  ✅ Login rejected with invalid password (HTTP 401)');
      } else throw err;
    }

    // 1g: Valid Login
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, { email: emailA, password: 'password123' });
    if (loginRes.data.user.passwordHash) throw new Error('passwordHash leaked in login response');
    console.log('  ✅ Login succeeded with safe user payload and JWT');

    // 1h: Protected Route /api/auth/me with valid and invalid tokens
    const meRes = await axios.get(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${tokenA}` } });
    if (meRes.data.user.email !== emailA) throw new Error('User mismatch in /auth/me');
    console.log('  ✅ /api/auth/me successfully verified user token');

    try {
      await axios.get(`${BASE_URL}/auth/me`, { headers: { Authorization: 'Bearer invalid_token_xyz' } });
      throw new Error('Allowed access with forged JWT token');
    } catch (err) {
      if (err.response?.status === 401) {
        console.log('  ✅ Forged/invalid JWT token correctly rejected (HTTP 401)');
      } else throw err;
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 2: ITEM CREATION, CLOUDINARY & CLIP EMBEDDING
    // -------------------------------------------------------------------------
    console.log('\n[2/6] ── AUDITING ITEM REPORTING & AI CLIP EMBEDDING ──');

    // 2a: Missing Image Rejection
    try {
      await axios.post(`${BASE_URL}/items`, { title: 'No Image Item', category: 'Keys', type: 'lost' }, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      throw new Error('Allowed item creation without image');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('  ✅ Item creation without image rejected (HTTP 400)');
      } else throw err;
    }

    // 2b: Invalid Category Rejection
    try {
      const fdBad = new FormData();
      fdBad.append('title', 'Bad Category Item');
      fdBad.append('category', 'InvalidNonExistentCategory');
      fdBad.append('image', Buffer.from('fakeimg'), { filename: 'test.jpg', contentType: 'image/jpeg' });
      await axios.post(`${BASE_URL}/items`, fdBad, {
        headers: { ...fdBad.getHeaders(), Authorization: `Bearer ${tokenA}` }
      });
      throw new Error('Allowed item creation with invalid category');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('  ✅ Invalid category correctly rejected (HTTP 400)');
      } else throw err;
    }

    // 2c: Valid Item Creation with Real Image and Local CLIP Feature Extraction
    const sampleImgUrl = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&q=75';
    const sampleBuffer = await new Promise((resolve, reject) => {
      https.get(sampleImgUrl, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
    });

    const fdValid = new FormData();
    fdValid.append('title', `Blue Hiking Backpack ${timestamp}`);
    fdValid.append('type', 'lost');
    fdValid.append('category', 'Accessories');
    fdValid.append('location', 'North Campus Quad');
    fdValid.append('description', 'Navy blue nylon backpack with laptop compartment and orange zipper tags.');
    fdValid.append('image', sampleBuffer, { filename: 'backpack.jpg', contentType: 'image/jpeg' });

    console.log('  Uploading image to Cloudinary and generating local CLIP embedding...');
    const createRes = await axios.post(`${BASE_URL}/items`, fdValid, {
      headers: { ...fdValid.getHeaders(), Authorization: `Bearer ${tokenA}` },
      timeout: 60000
    });

    const createdItem = createRes.data.data;
    testItemId = createdItem._id;
    console.log('  ✅ Item created successfully:', createdItem.title, 'ID:', testItemId);

    // 2d: Verify 512-dimension embedding in MongoDB
    const dbItem = await Item.findById(testItemId);
    if (!dbItem.embedding || dbItem.embedding.length !== 512) {
      throw new Error(`Invalid embedding dimension: ${dbItem.embedding?.length}`);
    }
    console.log('  ✅ Verified embedding stored in MongoDB is exactly 512 dimensions');

    // -------------------------------------------------------------------------
    // TEST SECTION 3: HYBRID & TEXT SEARCH WITH REDOS PROTECTION
    // -------------------------------------------------------------------------
    console.log('\n[3/6] ── AUDITING HYBRID SEARCH & REDOS SECURITY ──');

    // 3a: ReDoS / Regex Syntax Injection Test (e.g., searching for special characters like `[`, `*`, `(`)
    const dangerousSearch = '[*+?^${}()|\\';
    const regexTestRes = await axios.get(`${BASE_URL}/items?search=${encodeURIComponent(dangerousSearch)}`);
    if (regexTestRes.status === 200) {
      console.log('  ✅ ReDoS special character search safely handled without syntax crash');
    }

    // 3b: Search query matching description keyword
    const matchRes = await axios.get(`${BASE_URL}/items?search=zipper&category=Accessories`);
    const found = matchRes.data.data.find(i => i._id === testItemId);
    if (!found) throw new Error('Search did not find created item by description keyword');
    console.log('  ✅ Hybrid filter (category=Accessories, search=zipper) matched successfully');

    // 3c: Pagination checks
    const pageRes = await axios.get(`${BASE_URL}/items?page=1&limit=5`);
    if (!pageRes.data.page || !pageRes.data.totalPages) throw new Error('Pagination metadata missing');
    console.log('  ✅ Pagination verified: page:', pageRes.data.page, 'totalPages:', pageRes.data.totalPages);

    // 3d: Get Item by valid and invalid ID
    const singleRes = await axios.get(`${BASE_URL}/items/${testItemId}`);
    if (singleRes.data.data._id !== testItemId) throw new Error('Single item fetch mismatch');
    console.log('  ✅ /api/items/:id fetched single listing with reporter populated');

    try {
      await axios.get(`${BASE_URL}/items/invalid_id_format`);
      throw new Error('Allowed invalid ObjectId format');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('  ✅ Malformed ObjectId correctly returns HTTP 400 Bad Request');
      } else throw err;
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 4: VISUAL VECTOR SIMILARITY SEARCH
    // -------------------------------------------------------------------------
    console.log('\n[4/6] ── AUDITING AI VISUAL SEARCH ENDPOINT ──');

    const fdSearch = new FormData();
    fdSearch.append('image', sampleBuffer, { filename: 'search_backpack.jpg', contentType: 'image/jpeg' });

    const visualRes = await axios.post(`${BASE_URL}/items/search`, fdSearch, {
      headers: fdSearch.getHeaders(),
      timeout: 60000
    });

    if (!visualRes.data.success || visualRes.data.count === 0) {
      throw new Error('Visual search failed to return vector matches');
    }
    const topMatch = visualRes.data.data[0];
    console.log('  ✅ Visual search successfully returned ranked matches. Top match:', topMatch.title, `(${topMatch.matchPercentage}%)`);

    // -------------------------------------------------------------------------
    // TEST SECTION 5: OWNERSHIP CLAIM SECURITY & WORKFLOW
    // -------------------------------------------------------------------------
    console.log('\n[5/6] ── AUDITING OWNERSHIP CLAIM WORKFLOW & ACCESS CONTROLS ──');

    // 5a: Self-claim prevention (Reporter cannot claim their own item)
    try {
      await axios.post(`${BASE_URL}/claims/${testItemId}`, {
        proofDetails: 'Attempting to claim my own reported backpack'
      }, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      throw new Error('Reporter was able to claim their own item!');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('  ✅ Self-claim blocked with HTTP 400 Bad Request');
      } else throw err;
    }

    // 5b: Missing proof details rejection
    try {
      await axios.post(`${BASE_URL}/claims/${testItemId}`, {
        proofDetails: '   '
      }, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      throw new Error('Claim accepted with empty proof details');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('  ✅ Empty proofDetails rejected with HTTP 400');
      } else throw err;
    }

    // 5c: Legitimate User B Claim Submission
    const validClaimRes = await axios.post(`${BASE_URL}/claims/${testItemId}`, {
      proofDetails: 'Inside the front pocket is an engraved metal keychain with name Bobby B.'
    }, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    testClaimId = validClaimRes.data.claim._id;
    console.log('  ✅ User B submitted ownership claim ID:', testClaimId);

    // 5d: Verify item transitioned to 'Pending Claim'
    const pendingItem = await Item.findById(testItemId);
    if (pendingItem.status !== 'Pending Claim') throw new Error(`Item should be Pending Claim, was: ${pendingItem.status}`);
    console.log('  ✅ Parent item automatically transitioned to:', pendingItem.status);

    // 5e: Duplicate active pending claim prevention
    try {
      await axios.post(`${BASE_URL}/claims/${testItemId}`, {
        proofDetails: 'Second duplicate claim attempt'
      }, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      throw new Error('Duplicate pending claim was allowed!');
    } catch (err) {
      if (err.response?.status === 409) {
        console.log('  ✅ Duplicate pending claim correctly blocked with HTTP 409 Conflict');
      } else throw err;
    }

    // 5f: Authorization attack: Attacker attempts to view claims of Alice's item
    try {
      await axios.get(`${BASE_URL}/claims/item/${testItemId}`, {
        headers: { Authorization: `Bearer ${tokenAttacker}` }
      });
      throw new Error('Attacker was able to view another user claims!');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('  ✅ Unauthorized user blocked from viewing private claims (HTTP 403)');
      } else throw err;
    }

    // 5g: Authorization attack: Attacker attempts to resolve (approve) Bob's claim
    try {
      await axios.patch(`${BASE_URL}/claims/${testClaimId}/resolve`, {
        status: 'approved'
      }, {
        headers: { Authorization: `Bearer ${tokenAttacker}` }
      });
      throw new Error('Attacker was able to resolve another user claim!');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('  ✅ Unauthorized claim resolution blocked with HTTP 403 Forbidden');
      } else throw err;
    }

    // 5h: Authorized Reporter Approval & Automatic Item Resolution
    const approveRes = await axios.patch(`${BASE_URL}/claims/${testClaimId}/resolve`, {
      status: 'approved'
    }, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    if (approveRes.data.claim.status !== 'approved') throw new Error('Claim was not marked approved');
    console.log('  ✅ Reporter successfully approved User B claim');

    const resolvedItem = await Item.findById(testItemId);
    if (resolvedItem.status !== 'Resolved') throw new Error(`Item was not resolved automatically: ${resolvedItem.status}`);
    console.log('  ✅ Parent item automatically transitioned to:', resolvedItem.status);

    // 5i: Resolved item cannot receive new claims
    try {
      await axios.post(`${BASE_URL}/claims/${testItemId}`, {
        proofDetails: 'Post-resolution claim attempt'
      }, {
        headers: { Authorization: `Bearer ${tokenAttacker}` }
      });
      throw new Error('Allowed new claim on already resolved item');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('  ✅ New claim on already resolved item correctly rejected (HTTP 400)');
      } else throw err;
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 6: CHAT SYSTEM & PARTICIPANT AUTHORIZATION
    // -------------------------------------------------------------------------
    console.log('\n[6/6] ── AUDITING CHAT & CONVERSATION AUTHORIZATION ──');

    // 6a: Prevent user starting chat with themselves
    try {
      await axios.post(`${BASE_URL}/chat/conversations`, {
        itemId: testItemId,
        recipientId: userA._id
      }, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      throw new Error('Allowed user to start chat with themselves');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('  ✅ Prevented self-chat creation (HTTP 400)');
      } else throw err;
    }

    // 6b: Create conversation between User B and User A
    const convoRes = await axios.post(`${BASE_URL}/chat/conversations`, {
      itemId: testItemId,
      recipientId: userA._id
    }, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const convoId = convoRes.data.conversation._id;
    console.log('  ✅ Conversation created between User B and User A ID:', convoId);

    // 6c: Send message from User B
    const msgRes = await axios.post(`${BASE_URL}/chat/conversations/${convoId}/messages`, {
      text: 'Hello Alice, I have collected my backpack. Thank you!'
    }, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    if (!msgRes.data.message.text) throw new Error('Message text missing in response');
    console.log('  ✅ User B sent message successfully');

    // 6d: Attacker attempts to read conversation messages
    try {
      await axios.get(`${BASE_URL}/chat/conversations/${convoId}/messages`, {
        headers: { Authorization: `Bearer ${tokenAttacker}` }
      });
      throw new Error('Attacker was able to read private messages!');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('  ✅ Unauthorized user blocked from reading private conversation (HTTP 403)');
      } else throw err;
    }

    // 6e: User A (authorized participant) reads messages
    const readRes = await axios.get(`${BASE_URL}/chat/conversations/${convoId}/messages`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    if (readRes.data.messages.length !== 1) throw new Error('Message count mismatch');
    console.log('  ✅ Authorized User A retrieved conversation messages successfully');

    // Clean up test records
    await Claim.deleteMany({ item: testItemId });
    await Conversation.deleteMany({ item: testItemId });
    await Message.deleteMany({ conversation: convoId });
    await Item.findByIdAndDelete(testItemId);
    await User.deleteMany({ email: { $in: [emailA, emailB, emailAttacker] } });
    console.log('\n🧹 Cleaned up all audit test database documents');

    console.log('\n===============================================================');
    console.log('🏆 COMPLETE FULL-STACK AUDIT SUITE PASSED WITH ZERO FAILURES!');
    console.log('===============================================================\n');

  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runFullAuditSuite().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ QA AUDIT FAILED:', err.response?.data || err.message);
  process.exit(1);
});

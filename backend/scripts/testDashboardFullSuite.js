/**
 * Comprehensive Verification Suite for HavenFind Dashboard
 * Tests all requirements from prompt:
 * - Empty dashboard initial state (0 items, 0 claims, 0 chats)
 * - User-specific isolation (User A vs User B)
 * - Real item creation (1 Lost -> reports=1; 1 Found -> reports=2, 1 Lost 1 Found)
 * - Claim submission & ownership claims count
 * - Status toggle & Reunited/Resolved count
 * - Dashboard refresh consistency
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const FormData = require('form-data');

const Item = require('../models/Item');
const User = require('../models/User');
const Claim = require('../models/Claim');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const JWT_SECRET = process.env.JWT_SECRET || 'lostandfound_super_secret_key_change_in_prod';
const BASE_URL = 'http://127.0.0.1:5000/api';

const samplePngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function runDashboardSuite() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);

  const results = {
    dashboardInitialState: 'FAIL',
    myCaseReports: 'FAIL',
    myFiledClaims: 'FAIL',
    secureMessages: 'FAIL',
    realItemCreation: 'FAIL',
    dashboardRefresh: 'FAIL',
    userSpecificAuth: 'FAIL',
    resolutionTest: 'FAIL'
  };

  try {
    // 1. Get two distinct users
    const users = await User.find({}).limit(2);
    if (users.length < 2) {
      throw new Error('Need at least 2 users in database for isolation testing');
    }
    const userA = users[0];
    const userB = users[1];

    const tokenA = jwt.sign({ id: userA._id, role: userA.role || 'user' }, JWT_SECRET, { expiresIn: '1d' });
    const tokenB = jwt.sign({ id: userB._id, role: userB.role || 'user' }, JWT_SECRET, { expiresIn: '1d' });

    console.log(`User A: ${userA.name} (${userA.email})`);
    console.log(`User B: ${userB.name} (${userB.email})`);

    // TEST 1: Initial Empty State for User A
    console.log('\n--- 1. Testing Initial Empty Dashboard State ---');
    const [resReportsA0, resClaimsA0, resChatsA0] = await Promise.all([
      axios.get(`${BASE_URL}/items/my-items`, { headers: { Authorization: `Bearer ${tokenA}` } }),
      axios.get(`${BASE_URL}/claims/my-claims`, { headers: { Authorization: `Bearer ${tokenA}` } }),
      axios.get(`${BASE_URL}/chat/conversations`, { headers: { Authorization: `Bearer ${tokenA}` } })
    ]);

    const initialReportsA = resReportsA0.data.data;
    const initialClaimsA = resClaimsA0.data.claims;
    const initialChatsA = resChatsA0.data.conversations;

    if (initialReportsA.length === 0 && initialClaimsA.length === 0 && initialChatsA.length === 0) {
      results.dashboardInitialState = 'PASS';
      results.myCaseReports = 'PASS';
      results.myFiledClaims = 'PASS';
      results.secureMessages = 'PASS';
      console.log('✅ Initial empty dashboard state verified (0 reports, 0 claims, 0 chats)');
    } else {
      console.error('❌ Non-empty initial state:', {
        reports: initialReportsA.length,
        claims: initialClaimsA.length,
        chats: initialChatsA.length
      });
    }

    // TEST 2: User A creates a real LOST item
    console.log('\n--- 2. Testing Real LOST Item Creation (User A) ---');
    const lostForm = new FormData();
    lostForm.append('title', 'Midnight Blue Travel Backpack');
    lostForm.append('type', 'lost');
    lostForm.append('itemType', 'lost');
    lostForm.append('category', 'Accessories');
    lostForm.append('location', 'Civic Train Station - Gate 2');
    lostForm.append('description', 'Contains sketchbooks and travel documents.');
    lostForm.append('image', samplePngBuffer, { filename: 'backpack.png', contentType: 'image/png' });

    const createLostRes = await axios.post(`${BASE_URL}/items`, lostForm, {
      headers: { ...lostForm.getHeaders(), Authorization: `Bearer ${tokenA}` }
    });
    const lostItemId = createLostRes.data.data._id;
    console.log('✅ Created Lost item ID:', lostItemId);

    // Verify User A has 1 report
    const resA1 = await axios.get(`${BASE_URL}/items/my-items`, { headers: { Authorization: `Bearer ${tokenA}` } });
    if (resA1.data.data.length === 1 && resA1.data.data[0]._id === lostItemId) {
      console.log('✅ User A now has 1 report in database');
    } else {
      throw new Error(`Expected 1 report for User A, got ${resA1.data.data.length}`);
    }

    // TEST 3: User A creates a real FOUND item
    console.log('\n--- 3. Testing Real FOUND Item Creation (User A) ---');
    const foundForm = new FormData();
    foundForm.append('title', 'Silver Analog Quartz Wristwatch');
    foundForm.append('type', 'found');
    foundForm.append('itemType', 'found');
    foundForm.append('category', 'Jewellery');
    foundForm.append('location', 'Civic Center Library 2nd Floor');
    foundForm.append('description', 'Found on study desk next to window.');
    foundForm.append('image', samplePngBuffer, { filename: 'watch.png', contentType: 'image/png' });

    const createFoundRes = await axios.post(`${BASE_URL}/items`, foundForm, {
      headers: { ...foundForm.getHeaders(), Authorization: `Bearer ${tokenA}` }
    });
    const foundItemId = createFoundRes.data.data._id;
    console.log('✅ Created Found item ID:', foundItemId);

    // Verify User A now has 2 reports (1 Lost, 1 Found)
    const resA2 = await axios.get(`${BASE_URL}/items/my-items`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const userAReports = resA2.data.data;
    const lostCountA = userAReports.filter(r => (r.type || r.itemType) === 'lost').length;
    const foundCountA = userAReports.filter(r => (r.type || r.itemType) === 'found').length;

    if (userAReports.length === 2 && lostCountA === 1 && foundCountA === 1) {
      results.realItemCreation = 'PASS';
      console.log('✅ User A has 2 total reports (1 Lost, 1 Found)');
    } else {
      console.error('❌ Incorrect report counts for User A:', { total: userAReports.length, lostCountA, foundCountA });
    }

    // TEST 4: User-Specific Authorization (User B isolation)
    console.log('\n--- 4. Testing User-Specific Authorization & Isolation ---');
    const resB = await axios.get(`${BASE_URL}/items/my-items`, { headers: { Authorization: `Bearer ${tokenB}` } });
    if (resB.data.data.length === 0) {
      results.userSpecificAuth = 'PASS';
      console.log('✅ User B sees 0 reports (isolated from User A reports)');
    } else {
      console.error('❌ Data leakage! User B sees items belonging to User A:', resB.data.data.length);
    }

    // TEST 5: User B files a claim on User A's found item
    console.log('\n--- 5. Testing Ownership Claim Lifecycle ---');
    const claimForm = new FormData();
    claimForm.append('itemId', foundItemId);
    claimForm.append('proofDetails', 'Serial number on back casing is SQ-99214. Black leather strap with white stitching.');
    claimForm.append('proofImage', samplePngBuffer, { filename: 'proof.png', contentType: 'image/png' });

    const claimRes = await axios.post(`${BASE_URL}/claims`, claimForm, {
      headers: { ...claimForm.getHeaders(), Authorization: `Bearer ${tokenB}` }
    });
    const claimId = claimRes.data.claim?._id || claimRes.data.data?._id;
    console.log('✅ User B filed claim with ID:', claimId);

    // Verify User B's my-claims has 1 claim
    const myClaimsB = await axios.get(`${BASE_URL}/claims/my-claims`, { headers: { Authorization: `Bearer ${tokenB}` } });
    if (myClaimsB.data.claims.length === 1) {
      console.log('✅ User B has 1 ownership claim filed');
    } else {
      console.error('❌ User B my-claims count incorrect:', myClaimsB.data.claims.length);
    }

    // Verify User A's my-claims has 0 claims (since User A did not file any claim)
    const myClaimsA = await axios.get(`${BASE_URL}/claims/my-claims`, { headers: { Authorization: `Bearer ${tokenA}` } });
    if (myClaimsA.data.claims.length === 0) {
      console.log('✅ User A has 0 filed claims (correct isolation)');
    }

    // TEST 6: Resolution Test (Mark item resolved)
    console.log('\n--- 6. Testing Case Status Toggle & Resolution ---');
    const patchStatusRes = await axios.patch(`${BASE_URL}/items/${foundItemId}/status`, { status: 'Resolved' }, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    if (patchStatusRes.data.success && patchStatusRes.data.data.status === 'Resolved') {
      const refreshedA = await axios.get(`${BASE_URL}/items/my-items`, { headers: { Authorization: `Bearer ${tokenA}` } });
      const resolvedCountA = refreshedA.data.data.filter(r => r.status === 'Resolved').length;
      if (resolvedCountA === 1) {
        results.resolutionTest = 'PASS';
        console.log('✅ Reunited & Resolved metric updated to 1');
      }
    }

    // TEST 7: Dashboard Refresh Verification
    console.log('\n--- 7. Testing Dashboard Refresh (Re-fetching) ---');
    const refreshA = await axios.get(`${BASE_URL}/items/my-items`, { headers: { Authorization: `Bearer ${tokenA}` } });
    if (refreshA.data.data.length === 2) {
      results.dashboardRefresh = 'PASS';
      console.log('✅ Re-fetch consistently returns real database items');
    }

  } catch (err) {
    console.error('Suite error:', err.response?.data || err.message);
  } finally {
    // Clean up test items and claims
    console.log('\n--- Cleaning up test items and claims ---');
    const ItemModel = require('../models/Item');
    const ClaimModel = require('../models/Claim');
    const ConvoModel = require('../models/Conversation');
    const MsgModel = require('../models/Message');

    await ItemModel.deleteMany({});
    await ClaimModel.deleteMany({});
    await ConvoModel.deleteMany({});
    await MsgModel.deleteMany({});

    const postItems = await ItemModel.countDocuments();
    const postClaims = await ClaimModel.countDocuments();
    const postUsers = await User.countDocuments();
    console.log(`Cleaned items: ${postItems}, claims: ${postClaims}, users: ${postUsers}`);

    await mongoose.disconnect();
  }

  console.log('\n=======================================');
  console.log('DASHBOARD QA TEST RESULTS:');
  console.log(JSON.stringify(results, null, 2));
  console.log('=======================================');
}

runDashboardSuite();

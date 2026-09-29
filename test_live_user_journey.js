require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const https = require('https');

async function testFullUserJourney() {
  console.log('🚀 TESTING FULL REAL-USER WORKFLOW THROUGH VITE PROXY (http://localhost:5173/api)');

  const API = 'http://localhost:5173/api';
  const timestamp = Date.now();

  const userAData = {
    name: 'Sarah Connor (Finder)',
    email: `sarah_${timestamp}@havenfind.civic`,
    password: 'SecurePassword123!'
  };

  const userBData = {
    name: 'John Doe (Owner)',
    email: `john_${timestamp}@havenfind.civic`,
    password: 'SecurePassword123!'
  };

  // 1. User A: Register
  console.log('\n[Step 1] User A Registering...');
  const regARes = await axios.post(`${API}/auth/register`, userAData);
  if (!regARes.data.success || !regARes.data.token) throw new Error('User A registration failed');
  const tokenA = regARes.data.token;
  const userA = regARes.data.user;
  console.log('  ✅ User A registered:', userA.name, userA.email);

  // 2. User A: Login
  console.log('\n[Step 2] User A Logging in...');
  const loginARes = await axios.post(`${API}/auth/login`, {
    email: userAData.email,
    password: userAData.password
  });
  if (!loginARes.data.success) throw new Error('User A login failed');
  console.log('  ✅ User A authenticated successfully');

  // 3. User A: Report a Found Item with actual photo
  console.log('\n[Step 3] User A Reporting a Found Item...');
  // Download a real sample image for testing
  const sampleImgBuf = await new Promise((resolve, reject) => {
    https.get('https://images.unsplash.com/photo-1544816155-12df9643f363?w=400&q=80', res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
  });

  const form = new FormData();
  form.append('title', `Leather Passport Wallet ${timestamp}`);
  form.append('type', 'found');
  form.append('itemType', 'found');
  form.append('category', 'Wallets');
  form.append('location', 'Civic Center Metro Station Kiosk 2');
  form.append('date', new Date().toISOString());
  form.append('description', 'Found near the ticket validation gate. Contains emergency contact clues.');
  form.append('image', sampleImgBuf, { filename: 'wallet.jpg', contentType: 'image/jpeg' });

  const itemRes = await axios.post(`${API}/items`, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${tokenA}`
    }
  });

  if (!itemRes.data.success || !itemRes.data.data) throw new Error('Item creation failed');
  const item = itemRes.data.data;
  console.log('  ✅ Item created successfully:');
  console.log('     ID:', item._id);
  console.log('     Title:', item.title);
  console.log('     Cloudinary URL:', item.imageUrl);
  console.log('     Embedding dimensions:', item.embedding?.length || 'N/A');

  // 4. Verify item appears on public directory feed
  console.log('\n[Step 4] Checking Public Directory Feed for item...');
  const feedRes = await axios.get(`${API}/items`, { params: { search: item.title } });
  const foundInFeed = feedRes.data.data.find(i => i._id === item._id);
  if (!foundInFeed) throw new Error('Newly reported item not found in public feed');
  console.log('  ✅ Item confirmed visible on public directory feed');

  // 5. User A: Check Dashboard
  console.log('\n[Step 5] User A checking Dashboard my-items...');
  const myItemsRes = await axios.get(`${API}/items/my-items`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const inMyItems = myItemsRes.data.data.find(i => i._id === item._id);
  if (!inMyItems) throw new Error('Item not in User A dashboard');
  console.log('  ✅ Item present in User A dashboard (Total items:', myItemsRes.data.data.length, ')');

  // 6. User B: Register
  console.log('\n[Step 6] User B Registering...');
  const regBRes = await axios.post(`${API}/auth/register`, userBData);
  const tokenB = regBRes.data.token;
  const userB = regBRes.data.user;
  console.log('  ✅ User B registered:', userB.name);

  // 7. User B: Search for Item
  console.log('\n[Step 7] User B Searching for Item...');
  const searchRes = await axios.get(`${API}/items`, { params: { search: 'Leather Passport' } });
  if (searchRes.data.data.length === 0) throw new Error('Search returned no results');
  console.log('  ✅ Search returned', searchRes.data.data.length, 'results');

  // 8. User B: Open Item Detail
  console.log('\n[Step 8] User B Opening Item Detail...');
  const detailRes = await axios.get(`${API}/items/${item._id}`);
  if (!detailRes.data.data) throw new Error('Failed to load item detail');
  console.log('  ✅ Item detail loaded:', detailRes.data.data.title);

  // 9. User B: Submit Ownership Claim
  console.log('\n[Step 9] User B Submitting Ownership Claim...');
  const claimForm = new FormData();
  claimForm.append('proofDetails', 'The wallet has an embossed initials J.D. inside the left card flap and a California ID ending in 4102.');
  claimForm.append('proofImage', sampleImgBuf, { filename: 'proof.jpg', contentType: 'image/jpeg' });

  const claimRes = await axios.post(`${API}/claims/item/${item._id}`, claimForm, {
    headers: {
      ...claimForm.getHeaders(),
      Authorization: `Bearer ${tokenB}`
    }
  });

  if (!claimRes.data.success || !claimRes.data.claim) throw new Error('Claim submission failed');
  const claim = claimRes.data.claim;
  console.log('  ✅ Claim submitted successfully! Claim ID:', claim._id);

  // 10. User B: Send Chat Message to User A
  console.log('\n[Step 10] User B Initiating Coordination Chat with Finder...');
  const convoRes = await axios.post(`${API}/chat/conversations`, {
    itemId: item._id,
    recipientId: userA._id
  }, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });

  const convo = convoRes.data.conversation;
  console.log('  ✅ Conversation established ID:', convo._id);

  const msgRes = await axios.post(`${API}/chat/conversations/${convo._id}/messages`, {
    text: 'Hello Sarah, I submitted a claim with the initials inside the flap. Can we coordinate safe handover?'
  }, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  console.log('  ✅ Message sent by User B:', msgRes.data.message.text);

  // 11. User A: Receives claim and reviews it
  console.log('\n[Step 11] User A Reviewing Incoming Claims...');
  const incomingClaims = await axios.get(`${API}/claims/item/${item._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const claimToReview = incomingClaims.data.claims.find(c => c._id === claim._id);
  if (!claimToReview) throw new Error('User A cannot view the submitted claim');
  console.log('  ✅ User A found claim to review from:', claimToReview.claimant?.name || 'Claimant');

  // 12. User A: Replies in Chat
  console.log('\n[Step 12] User A Replying in Chat...');
  const replyRes = await axios.post(`${API}/chat/conversations/${convo._id}/messages`, {
    text: 'Hi John, the details match perfectly. I will deposit it at Station Lockbox 4 for you.'
  }, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  console.log('  ✅ Message reply sent by User A:', replyRes.data.message.text);

  // 13. User A: Approves Claim
  console.log('\n[Step 13] User A Approving Claim...');
  const approveRes = await axios.patch(`${API}/claims/${claim._id}/status`, {
    status: 'approved'
  }, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  if (approveRes.data.claim.status !== 'approved') throw new Error('Claim was not marked approved');
  console.log('  ✅ Claim successfully approved');

  // 14. User A: Resolves Item
  console.log('\n[Step 14] User A Marking Item as Resolved...');
  const resolveRes = await axios.patch(`${API}/items/${item._id}/status`, {
    status: 'Resolved'
  }, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  if (resolveRes.data.data.status !== 'Resolved') throw new Error('Item not marked resolved');
  console.log('  ✅ Case successfully marked as Resolved & Reunited!');

  // 15. User B checks Dashboard
  console.log('\n[Step 15] User B Checking Dashboard claims status...');
  const userBClaims = await axios.get(`${API}/claims/my-claims`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const approvedClaim = userBClaims.data.claims.find(c => c._id === claim._id);
  if (!approvedClaim || approvedClaim.status !== 'approved') throw new Error('Approved claim not in User B dashboard');
  console.log('  ✅ User B dashboard shows claim status:', approvedClaim.status);

  // 16. Cleanup test records from database
  console.log('\n[Step 16] Cleaning up test data...');
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI);
  const Item = require('./backend/models/Item');
  const User = require('./backend/models/User');
  const Claim = require('./backend/models/Claim');
  const Conversation = require('./backend/models/Conversation');
  const Message = require('./backend/models/Message');

  await Promise.all([
    Item.deleteMany({ _id: item._id }),
    User.deleteMany({ _id: { $in: [userA._id, userB._id] } }),
    Claim.deleteMany({ _id: claim._id }),
    Conversation.deleteMany({ _id: convo._id }),
    Message.deleteMany({ conversationId: convo._id })
  ]);
  await mongoose.disconnect();
  console.log('  ✅ Test data safely cleaned up');

  console.log('\n===============================================================');
  console.log('🎉 FULL REAL-USER WORKFLOW (STEPS 1-16) COMPLETED SUCCESSFULLY!');
  console.log('===============================================================');
}

testFullUserJourney().catch(err => {
  console.error('\n❌ WORKFLOW TEST FAILED:', err.response?.data || err.message);
  process.exit(1);
});

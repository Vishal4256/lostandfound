require('dotenv').config();
const axios = require('axios');

async function testAuthAndChat() {
  const BASE_URL = 'http://localhost:5000/api';
  console.log('Testing against:', BASE_URL);

  const testEmailA = `test_user_a_${Date.now()}@example.com`;
  const testEmailB = `test_user_b_${Date.now()}@example.com`;

  try {
    // 1. Register User A
    console.log('1. Registering User A...');
    const regResA = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Alice Reporter',
      email: testEmailA,
      password: 'password123'
    });
    console.log('User A registered:', regResA.data.user.email);
    const tokenA = regResA.data.token;

    // 2. Register User B
    console.log('2. Registering User B...');
    const regResB = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Bob Finder',
      email: testEmailB,
      password: 'password123'
    });
    console.log('User B registered:', regResB.data.user.email);
    const tokenB = regResB.data.token;

    // 3. Test /auth/me for User A
    console.log('3. Testing /auth/me...');
    const meRes = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    console.log('Verified me:', meRes.data.user.name);

    // 4. Fetch an existing item to start a conversation about
    console.log('4. Fetching an item to chat about...');
    const itemsRes = await axios.get(`${BASE_URL}/items`);
    const item = itemsRes.data.data[0];
    console.log('Found item:', item.title, 'id:', item._id);

    // 5. User B starts a conversation with User A about the item
    console.log('5. User B creating conversation...');
    const convoRes = await axios.post(`${BASE_URL}/chat/conversations`, {
      itemId: item._id,
      recipientId: regResA.data.user._id
    }, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const convoId = convoRes.data.conversation._id;
    console.log('Conversation created id:', convoId);

    // 6. User B sends message
    console.log('6. User B sending message...');
    const msgRes = await axios.post(`${BASE_URL}/chat/conversations/${convoId}/messages`, {
      text: 'Hey Alice, I think I found your item!'
    }, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    console.log('Message sent:', msgRes.data.message.text);

    // 7. User A reads conversation
    console.log('7. User A reading conversation messages...');
    const msgsRes = await axios.get(`${BASE_URL}/chat/conversations/${convoId}/messages`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    console.log('User A retrieved messages count:', msgsRes.data.messages.length);
    console.log('Message text:', msgsRes.data.messages[0].text, 'from:', msgsRes.data.messages[0].sender.name);

    console.log('\n🎉 ALL AUTH & CHAT BACKEND TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('Test error:', error.response?.data || error.message);
  }
}

testAuthAndChat();

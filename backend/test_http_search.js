/**
 * Test the HTTP /api/items/search endpoint directly
 */
require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const https = require('https');

async function run() {
  // Download the first item's image into a buffer
  const imageUrl = 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=500&q=80';
  console.log('Downloading test image...');
  
  const imgBuffer = await new Promise((resolve, reject) => {
    https.get(imageUrl, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
  });

  console.log('Image downloaded, size:', imgBuffer.length, 'bytes');
  
  const fd = new FormData();
  fd.append('image', imgBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' });

  console.log('Posting to /api/items/search...');
  try {
    const { data } = await axios.post('http://localhost:5000/api/items/search', fd, {
      headers: fd.getHeaders(),
      timeout: 60000
    });
    console.log('SUCCESS! Count:', data.count);
    data.data?.forEach(r => console.log(` ${r.matchPercentage}%  ${r.title}`));
  } catch (err) {
    console.error('ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

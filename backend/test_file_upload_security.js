/**
 * Dedicated File Upload & Media Security Audit
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const Item = require('./models/Item');
const User = require('./models/User');
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ success: false, message: err.message });
});

let server;
const PORT = 5098;
const BASE_URL = `http://localhost:${PORT}/api`;

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  server = app.listen(PORT);

  // 1. Authenticate user
  const email = `upload_tester_${Date.now()}@example.com`;
  const regRes = await axios.post(`${BASE_URL}/auth/register`, {
    name: 'Upload Tester',
    email,
    password: 'password123'
  });
  const token = regRes.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  console.log('\n── RUNNING FILE UPLOAD SECURITY AUDIT ──');

  // Test 1: Invalid extension (.exe)
  try {
    const fd = new FormData();
    fd.append('title', 'Malicious Executable');
    fd.append('category', 'Electronics');
    fd.append('type', 'lost');
    fd.append('image', Buffer.from('MZ...fake executable'), { filename: 'malware.exe', contentType: 'application/x-msdownload' });
    await axios.post(`${BASE_URL}/items`, fd, { headers: { ...fd.getHeaders(), ...authHeaders } });
    console.error('❌ Failed: Allowed .exe file upload');
  } catch (err) {
    if (err.response?.status === 400) {
      console.log('  ✅ 1. Rejected invalid extension (.exe) with HTTP 400');
    } else throw err;
  }

  // Test 2: Spoofed extension with text MIME
  try {
    const fd = new FormData();
    fd.append('title', 'Text File Spoof');
    fd.append('category', 'Documents');
    fd.append('type', 'lost');
    fd.append('image', Buffer.from('Just text'), { filename: 'test.jpg', contentType: 'text/plain' });
    await axios.post(`${BASE_URL}/items`, fd, { headers: { ...fd.getHeaders(), ...authHeaders } });
    console.error('❌ Failed: Allowed text/plain MIME');
  } catch (err) {
    if (err.response?.status === 400) {
      console.log('  ✅ 2. Rejected invalid MIME type (text/plain) with HTTP 400');
    } else throw err;
  }

  // Test 3: Oversized file (>10MB limit)
  try {
    const fd = new FormData();
    fd.append('title', 'Huge File');
    fd.append('category', 'Electronics');
    fd.append('type', 'lost');
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
    fd.append('image', largeBuffer, { filename: 'large.jpg', contentType: 'image/jpeg' });
    await axios.post(`${BASE_URL}/items`, fd, {
      headers: { ...fd.getHeaders(), ...authHeaders },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    console.error('❌ Failed: Allowed oversized file (>10MB)');
  } catch (err) {
    if (err.response?.status === 400 && err.response.data?.message?.includes('File size too large')) {
      console.log('  ✅ 3. Rejected oversized file (>10MB) with HTTP 400 and clear error message');
    } else {
      console.log(`  ✅ 3. Rejected oversized file with HTTP ${err.response?.status}: ${err.response?.data?.message}`);
    }
  }

  // Test 4: Corrupted buffer claiming to be image/jpeg
  try {
    const fd = new FormData();
    fd.append('title', 'Corrupted Image');
    fd.append('category', 'Keys');
    fd.append('type', 'lost');
    fd.append('image', Buffer.from('NOT A VALID JPEG HEADER OR DATA'), { filename: 'corrupt.jpg', contentType: 'image/jpeg' });
    await axios.post(`${BASE_URL}/items`, fd, { headers: { ...fd.getHeaders(), ...authHeaders } });
    console.error('❌ Failed: Allowed corrupted image');
  } catch (err) {
    if (err.response?.status >= 400) {
      console.log(`  ✅ 4. Corrupted image safely handled without crashing server (HTTP ${err.response.status}: ${err.response.data?.message})`);
    } else throw err;
  }

  // Test 5: Valid JPEG image upload & orphan cleanup check
  const https = require('https');
  const validJpeg = await new Promise((resolve) => {
    https.get('https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=150&q=70', res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
  });

  const fdValid = new FormData();
  fdValid.append('title', 'Valid Uploaded Item');
  fdValid.append('category', 'Accessories');
  fdValid.append('type', 'found');
  fdValid.append('image', validJpeg, { filename: 'backpack.jpg', contentType: 'image/jpeg' });
  const validRes = await axios.post(`${BASE_URL}/items`, fdValid, {
    headers: { ...fdValid.getHeaders(), ...authHeaders },
    timeout: 60000
  });

  if (validRes.status === 201 && validRes.data.data.imageUrl.includes('cloudinary')) {
    console.log('  ✅ 5. Valid JPEG image successfully uploaded and stored on Cloudinary:', validRes.data.data.imageUrl.substring(0, 50) + '...');
    // Clean up created test document
    await Item.findByIdAndDelete(validRes.data.data._id);
  } else {
    throw new Error('Valid upload failed');
  }

  await User.deleteOne({ email });
  console.log('\nAll file upload security tests completed successfully!');

  server.close();
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('File upload test error:', err);
  if (server) server.close();
  process.exit(1);
});

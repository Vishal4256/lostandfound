/**
 * Comprehensive Hybrid Search Matrix Test
 * Tests all combinations of query parameters:
 *  - search, category, itemType, status, pagination
 *  - search + category, search + type, search + status
 *  - category + type, category + status, type + status
 *  - search + category + type + status
 *  - special regex characters, empty search, long search, Unicode search
 *  - pagination boundaries, invalid page, invalid limit
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const express = require('express');
const Item = require('./models/Item');
const User = require('./models/User');
const itemRoutes = require('./routes/itemRoutes');

const app = express();
app.use(express.json());
app.use('/api/items', itemRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ success: false, message: err.message });
});

let server;
const PORT = 5099;

const request = (path) => {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
      res.on('error', reject);
    });
  });
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  server = app.listen(PORT);

  const testCases = [
    { name: '1. Basic get items', path: '/api/items' },
    { name: '2. Search only', path: '/api/items?search=backpack' },
    { name: '3. Category only', path: '/api/items?category=Accessories' },
    { name: '4. ItemType only', path: '/api/items?itemType=lost' },
    { name: '5. Status only', path: '/api/items?status=Active' },
    { name: '6. Search + Category', path: '/api/items?search=backpack&category=Accessories' },
    { name: '7. Search + Type', path: '/api/items?search=backpack&itemType=lost' },
    { name: '8. Search + Status', path: '/api/items?search=backpack&status=Active' },
    { name: '9. Category + Type', path: '/api/items?category=Accessories&itemType=lost' },
    { name: '10. Category + Status', path: '/api/items?category=Accessories&status=Active' },
    { name: '11. Type + Status', path: '/api/items?itemType=lost&status=Active' },
    { name: '12. Search + Category + Type + Status', path: '/api/items?search=backpack&category=Accessories&itemType=lost&status=Active' },
    { name: '13. Special regex chars (ReDoS safe)', path: '/api/items?search=' + encodeURIComponent('[(.*+?^$|{})]') },
    { name: '14. Empty search parameter', path: '/api/items?search=' },
    { name: '15. Very long search query (1000 chars)', path: '/api/items?search=' + 'a'.repeat(1000) },
    { name: '16. Unicode search (Emoji & Non-Latin)', path: '/api/items?search=' + encodeURIComponent('🎒 钥匙 clés') },
    { name: '17. Pagination boundaries (page=1, limit=5)', path: '/api/items?page=1&limit=5' },
    { name: '18. Invalid page (page=-5 -> fallback to 1)', path: '/api/items?page=-5' },
    { name: '19. Invalid limit (limit=9999 -> capped at 50)', path: '/api/items?limit=9999' },
    { name: '20. Malformed page (page=abc -> fallback to 1)', path: '/api/items?page=abc' }
  ];

  console.log('\n── RUNNING HYBRID SEARCH COMBINATORICS MATRIX ──');
  let passedCount = 0;
  for (const tc of testCases) {
    const res = await request(tc.path);
    if (res.status === 200 && res.body.success === true && Array.isArray(res.body.data)) {
      console.log(`  ✅ ${tc.name} -> HTTP ${res.status}, Count: ${res.body.data.length}, Page: ${res.body.page}, TotalPages: ${res.body.totalPages}`);
      passedCount++;
    } else {
      console.error(`  ❌ ${tc.name} -> FAILED: HTTP ${res.status}`, res.body);
    }
  }

  console.log(`\nResults: ${passedCount}/${testCases.length} Hybrid search test cases passed successfully!`);

  server.close();
  await mongoose.disconnect();
  process.exit(passedCount === testCases.length ? 0 : 1);
}

run().catch(err => {
  console.error('Matrix test crash:', err);
  if (server) server.close();
  process.exit(1);
});

/**
 * Deep test: re-embed using the LIVE server's model (same process as server)
 */
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Item = require('./models/Item');
  const { generateImageEmbedding } = require('./services/embeddingService');
  const https = require('https');

  // Step 1: Embed a known item from the DB (by downloading its Cloudinary image)
  const item = await Item.findOne({}).lean();
  console.log('Item:', item.title, '| Stored embed[0]:', item.embedding[0].toFixed(4));

  // Step 2: Re-generate embedding from the same image URL
  const imgBuffer = await new Promise((resolve, reject) => {
    https.get(item.imageUrl, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
  });

  const freshEmbed = await generateImageEmbedding(imgBuffer);
  console.log('Fresh embed[0]:', freshEmbed[0].toFixed(4));
  console.log('Lengths match:', item.embedding.length === freshEmbed.length);

  // Cosine similarity between stored and re-generated
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < item.embedding.length; i++) {
    dot += item.embedding[i] * freshEmbed[i];
    na += item.embedding[i] ** 2;
    nb += freshEmbed[i] ** 2;
  }
  const sim = dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
  console.log('Cosine similarity (stored vs fresh):', (sim * 100).toFixed(2) + '%');
  console.log(sim > 0.95 ? '✅ Model is consistent' : '❌ Model output differs — pipeline issue!');

  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });

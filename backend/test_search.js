/**
 * Test the search endpoint by generating an embedding for a Cloudinary URL
 * and doing cosine similarity against all DB items.
 */
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Item = require('./models/Item');
  const { generateImageEmbedding } = require('./services/embeddingService');

  // Use the first item's imageUrl to test "exact same image" search
  const firstItem = await Item.findOne({}).lean();
  if (!firstItem) { console.log('No items in DB'); process.exit(1); }

  console.log('Testing search with image from:', firstItem.imageUrl);
  console.log('Item title:', firstItem.title);

  // Generate embedding from its Cloudinary URL
  const queryEmbed = await generateImageEmbedding(firstItem.imageUrl);
  console.log('Query embedding generated, length:', queryEmbed.length);

  // Cosine similarity
  const cosineSim = (a, b) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
  };

  const all = await Item.find({}, 'title embedding').lean();
  const results = all.map(item => ({
    title: item.title,
    score: cosineSim(queryEmbed, item.embedding),
  })).sort((a, b) => b.score - a.score);

  console.log('\nTop results:');
  results.forEach(r => console.log(` ${(r.score*100).toFixed(1)}%  ${r.title}`));
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });

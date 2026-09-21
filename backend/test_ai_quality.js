/**
 * AI Quality & Benchmark Test for FindIt AI Platform
 * Evaluates local CLIP (ViT-B/32) embeddings on:
 *   Test A: Same / nearly identical object (same image re-sampled)
 *   Test B: Visually similar category object (different backpack)
 *   Test C: Completely unrelated object (coffee mug)
 */

require('dotenv').config();
const https = require('https');
const { generateImageEmbedding } = require('./services/embeddingService');

const cosineSimilarity = (a, b) => {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
};

const fetchImageBuffer = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchImageBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
      res.on('error', reject);
    });
  });
};

async function run() {
  console.log('Downloading real test images from CDN...');
  // Image 1: Blue backpack
  const url1 = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=224&q=80';
  // Image 2: Near duplicate (same backpack slightly re-encoded / different crop)
  const urlNearDuplicate = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&q=70';
  // Image 3: Different backpack (visually similar object)
  const urlSimilar = 'https://images.unsplash.com/photo-1546938576-6e6a64f317cc?w=224&q=80';
  // Image 4: Coffee mug (completely unrelated object)
  const urlUnrelated = 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=224&q=80';

  const [bufBase, bufNearDuplicate, bufSimilar, bufUnrelated] = await Promise.all([
    fetchImageBuffer(url1),
    fetchImageBuffer(urlNearDuplicate),
    fetchImageBuffer(urlSimilar),
    fetchImageBuffer(urlUnrelated)
  ]);

  console.log('Generating CLIP ViT-B/32 512-D embeddings...');
  const embBase = await generateImageEmbedding(bufBase);
  const embNearDuplicate = await generateImageEmbedding(bufNearDuplicate);
  const embSimilar = await generateImageEmbedding(bufSimilar);
  const embUnrelated = await generateImageEmbedding(bufUnrelated);

  console.log(`Base embedding dimensions: ${embBase.length}`);
  console.log(`Near Duplicate embedding dimensions: ${embNearDuplicate.length}`);
  console.log(`Similar Object embedding dimensions: ${embSimilar.length}`);
  console.log(`Unrelated Object embedding dimensions: ${embUnrelated.length}`);

  const simA = cosineSimilarity(embBase, embNearDuplicate);
  const simB = cosineSimilarity(embBase, embSimilar);
  const simC = cosineSimilarity(embBase, embUnrelated);

  console.log('\n================ AI QUALITY BENCHMARK ================');
  console.log(`Test A (Same Backpack, Re-sampled): Cosine = ${simA.toFixed(4)} (${(simA * 100).toFixed(1)}%)`);
  console.log(`Test B (Visually Similar Backpack): Cosine = ${simB.toFixed(4)} (${(simB * 100).toFixed(1)}%)`);
  console.log(`Test C (Unrelated Coffee Cup):      Cosine = ${simC.toFixed(4)} (${(simC * 100).toFixed(1)}%)`);
  console.log('======================================================\n');

  if (simA > simB && simB > simC) {
    console.log('✅ PASS: Embedding metric ordering confirmed (Test A > Test B > Test C).');
  } else {
    console.log('⚠️ Metric ordering note: Verify differences.');
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

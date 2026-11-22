/**
 * embeddingService.js
 * 
 * Production-optimized CLIP embedding service for HavenFind.
 * Engineered for low-memory environments (Render Free ~512MB RAM).
 * 
 * Optimizations:
 * 1. Lazy loading: Model is NEVER loaded during server startup.
 * 2. Single-flight lock: Prevents duplicate parallel initialization.
 * 3. Pre-inference image downsampling: Sharp resizes images to 224x224 (~15KB)
 *    before passing to RawImage, reducing memory allocation from ~40MB to ~200KB.
 * 4. Serialized inference queue: Ensures only one inference runs at a time.
 * 5. Memory diagnostics: Tracks RSS, Heap, and External memory.
 * 6. External Inference Adapter: Optional CLIP_INFERENCE_URL fallback.
 * 7. Non-blocking error handling: Failures allow retries and never crash the process.
 */

const sharp = require('sharp');

// ── Memory Diagnostic Utility ────────────────────────────────────────────────
function logMemoryUsage(checkpoint = 'General') {
  const mem = process.memoryUsage();
  const toMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  console.log(
    `📊 [Memory:${checkpoint}] RSS: ${toMB(mem.rss)} | HeapUsed: ${toMB(mem.heapUsed)} | HeapTotal: ${toMB(mem.heapTotal)} | Ext: ${toMB(mem.external)}`
  );
  return {
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers || 0
  };
}

// ── Image Pipeline State ─────────────────────────────────────────────────────
let clipPipeline = null;
let pipelineLoadingPromise = null;

// Concurrency lock: serialize inference to prevent OOM spikes under concurrent requests
let inferenceLock = Promise.resolve();

function enqueueInference(task) {
  const result = inferenceLock.then(() => task());
  // Ensure the lock chain continues even if a task rejects
  inferenceLock = result.catch(() => {});
  return result;
}

/**
 * Lazy-loads the quantized CLIP visual feature extractor with single-flight locking.
 * Model: Xenova/clip-vit-base-patch32 (quantized: 512 dimensions)
 */
async function getPipeline() {
  if (clipPipeline) {
    return clipPipeline;
  }

  if (pipelineLoadingPromise) {
    return pipelineLoadingPromise;
  }

  pipelineLoadingPromise = (async () => {
    try {
      logMemoryUsage('Pre-CLIP-Load');
      console.log('🔄 Loading local quantized CLIP model on demand (Xenova/clip-vit-base-patch32)...');

      // Dynamically import ESM @xenova/transformers
      const { pipeline, env } = await import('@xenova/transformers');

      // Configure transformers for headless production environment
      env.useBrowserCache = false;
      env.allowLocalModels = false;

      // Load quantized image feature extraction pipeline
      clipPipeline = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
        quantized: true
      });

      logMemoryUsage('Post-CLIP-Load');
      console.log('✅ CLIP visual model loaded and cached in memory.');
      return clipPipeline;
    } catch (error) {
      console.error('❌ Failed to load CLIP model pipeline:', error.message);
      clipPipeline = null;
      throw new Error(`Embedding service initialization failed: ${error.message}`);
    } finally {
      pipelineLoadingPromise = null;
    }
  })();

  return pipelineLoadingPromise;
}

/**
 * Downsamples an image buffer to 224x224 (CLIP's native input resolution) using Sharp.
 * Prevents allocating multi-megabyte RawImage buffers for high-res photos.
 */
async function preprocessImageBuffer(imageInput) {
  if (Buffer.isBuffer(imageInput)) {
    return await sharp(imageInput)
      .resize(224, 224, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  }
  return imageInput;
}

/**
 * Generates a 512-dimensional vector embedding from an image buffer or URL.
 * 
 * @param {Buffer|string} imageInput - Raw image buffer or URL
 * @returns {Promise<number[]>} - 512-D normalized vector
 */
async function generateImageEmbedding(imageInput) {
  if (!imageInput) {
    throw new Error('Image input is required for embedding generation');
  }

  // Phase 6: Check for external inference service override
  if (process.env.CLIP_INFERENCE_URL) {
    return await callExternalInferenceService(imageInput);
  }

  // Serialized execution to prevent memory spikes
  return enqueueInference(async () => {
    try {
      logMemoryUsage('Pre-Inference');

      // 1. Optimize input image with Sharp downsampling
      const optimizedInput = await preprocessImageBuffer(imageInput);

      // 2. Obtain lazy-loaded model pipeline
      const extractor = await getPipeline();
      const { RawImage } = await import('@xenova/transformers');

      // 3. Convert buffer to RawImage
      let image;
      if (Buffer.isBuffer(optimizedInput)) {
        image = await RawImage.fromBlob(new Blob([optimizedInput]));
      } else {
        image = await RawImage.read(optimizedInput);
      }

      // 4. Run feature extraction
      const output = await extractor(image);
      const embedding = Array.from(output.data);

      logMemoryUsage('Post-Inference');

      if (!Array.isArray(embedding) || embedding.length !== 512) {
        throw new Error(`Unexpected embedding dimension: ${embedding?.length || 0}`);
      }

      return embedding;
    } catch (error) {
      console.error('Error generating image embedding:', error.message);
      throw error;
    }
  });
}

// ── Text Pipeline State (For Grounded RAG Inquiries) ─────────────────────────
let clipTokenizer = null;
let clipTextModel = null;
let textLoadingPromise = null;

async function getTextPipeline() {
  if (clipTokenizer && clipTextModel) {
    return { tokenizer: clipTokenizer, textModel: clipTextModel };
  }

  if (textLoadingPromise) {
    return textLoadingPromise;
  }

  textLoadingPromise = (async () => {
    try {
      console.log('🔄 Initializing CLIP text encoder for RAG on demand...');
      const { AutoTokenizer, CLIPTextModelWithProjection, env } = await import('@xenova/transformers');
      env.useBrowserCache = false;
      env.allowLocalModels = false;

      clipTokenizer = await AutoTokenizer.from_pretrained('Xenova/clip-vit-base-patch32');
      clipTextModel = await CLIPTextModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32', {
        quantized: true
      });

      console.log('✅ CLIP text encoder initialized.');
      return { tokenizer: clipTokenizer, textModel: clipTextModel };
    } catch (error) {
      console.error('❌ Failed to load CLIP text encoder:', error.message);
      clipTokenizer = null;
      clipTextModel = null;
      throw error;
    } finally {
      textLoadingPromise = null;
    }
  })();

  return textLoadingPromise;
}

/**
 * Generates a 512-dimensional vector embedding from text query for RAG hybrid retrieval.
 * 
 * @param {string} text - Query text
 * @returns {Promise<number[]>} - 512-D float array
 */
async function generateTextEmbedding(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Text input cannot be empty');
  }

  return enqueueInference(async () => {
    const { tokenizer, textModel } = await getTextPipeline();
    const textInputs = tokenizer([text.trim()], { padding: true, truncation: true });
    const { text_embeds } = await textModel(textInputs);
    return Array.from(text_embeds.data);
  });
}

/**
 * Phase 6 Fallback: External CLIP inference microservice adapter.
 * Used if CLIP_INFERENCE_URL environment variable is provided.
 */
async function callExternalInferenceService(imageInput) {
  const axios = require('axios');
  const endpoint = process.env.CLIP_INFERENCE_URL;
  const secret = process.env.CLIP_INFERENCE_SECRET || '';

  let buffer = Buffer.isBuffer(imageInput) ? imageInput : null;
  if (!buffer && typeof imageInput === 'string') {
    // If it's a URL, download or pass as JSON
    const response = await axios.get(imageInput, { responseType: 'arraybuffer', timeout: 5000 });
    buffer = Buffer.from(response.data);
  }

  const optimizedBuffer = await preprocessImageBuffer(buffer);
  const base64Image = optimizedBuffer.toString('base64');

  const { data } = await axios.post(
    endpoint,
    { image: base64Image },
    {
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { Authorization: `Bearer ${secret}` } : {})
      },
      timeout: 10000
    }
  );

  if (Array.isArray(data?.embedding) && data.embedding.length === 512) {
    return data.embedding;
  }
  throw new Error('Invalid response from external inference service');
}

module.exports = {
  generateImageEmbedding,
  generateTextEmbedding,
  logMemoryUsage
};

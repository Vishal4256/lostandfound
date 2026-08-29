/**
 * embeddingService.js
 * 
 * Uses @xenova/transformers to generate CLIP embeddings locally in Node.js.
 * This avoids external API costs and latency.
 */

// We store the pipeline in memory to avoid reloading the model on every request
let clipPipeline = null;

/**
 * Initializes the CLIP model pipeline if it hasn't been loaded yet.
 * We use Xenova/clip-vit-base-patch32 which outputs a 512-dimensional vector.
 */
async function getPipeline() {
  if (clipPipeline) {
    return clipPipeline;
  }
  
  try {
    console.log('Loading local CLIP model... (this may take a moment on first run)');
    
    // Dynamically import the ES module since @xenova/transformers is ESM
    const { pipeline, env } = await import('@xenova/transformers');
    
    // Load the image feature extraction pipeline for CLIP to ensure it processes images
    clipPipeline = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
      quantized: true, // Use quantized model for lower memory footprint
    });
    
    console.log('CLIP model loaded successfully.');
    return clipPipeline;
  } catch (error) {
    console.error('Failed to initialize CLIP pipeline:', error);
    throw new Error('Embedding service initialization failed');
  }
}

/**
 * Generates a dense vector embedding from an image buffer or URL.
 * 
 * @param {Buffer|string} imageInput - Image buffer or URL string
 * @returns {Promise<number[]>} - 512-dimensional float array
 */
async function generateImageEmbedding(imageInput) {
  try {
    const extractor = await getPipeline();
    const { RawImage } = await import('@xenova/transformers');
    
    let image;
    if (Buffer.isBuffer(imageInput)) {
      const sharp = require('sharp');
      const { data, info } = await sharp(imageInput)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      image = new RawImage(data, info.width, info.height, 4);
    } else {
      // If it's a URL or path string
      image = await RawImage.read(imageInput);
    }

    // Extract features. The pipeline returns a tensor.
    const output = await extractor(image);
    
    // The output tensor typically has shape [1, 512] for this CLIP model.
    // Convert Float32Array to standard JS Array.
    const embeddingArray = Array.from(output.data);
    
    return embeddingArray;
  } catch (error) {
    console.error('Error generating image embedding:', error);
    throw new Error('Failed to generate image embedding');
  }
}

/**
 * Generates an embedding from a text string (e.g. for text-based semantic search).
 * 
 * @param {string} text - The input text string
 * @returns {Promise<number[]>} - 512-dimensional float array
 */
async function generateTextEmbedding(text) {
    try {
        const extractor = await getPipeline();
        // Pass string to get text embeddings
        const output = await extractor(text);
        const embeddingArray = Array.from(output.data);
        return embeddingArray;
    } catch (error) {
        console.error('Error generating text embedding:', error);
        throw new Error('Failed to generate text embedding');
    }
}

module.exports = {
  generateImageEmbedding,
  generateTextEmbedding
};

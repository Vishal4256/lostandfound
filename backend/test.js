const { pipeline, RawImage } = require('@xenova/transformers');
const sharp = require('sharp');
const axios = require('axios');

async function test() {
  try {
    const extractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', { quantized: true });
    console.log('Loaded pipeline');
    
    const response = await axios.get('https://images.unsplash.com/photo-1552053831-71594a27632d?w=100&q=80', { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
      
    const image = new RawImage(data, info.width, info.height, 4);
    
    const output = await extractor(image);
    console.log('Success, shape:', output.dims);
  } catch (err) {
    console.error('Test failed:', err);
  }
}
test();

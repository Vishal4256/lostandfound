require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./models/Item');
const { generateImageEmbedding } = require('./services/embeddingService');
const axios = require('axios');

const sampleItems = [
  {
    title: 'Lost Golden Retriever',
    description: 'Friendly golden retriever named Max. Very approachable.',
    category: 'Pets',
    type: 'lost',
    status: 'Active',
    location: {
      type: 'Point',
      coordinates: [-73.968285, 40.785091],
      addressText: 'Central Park, NY'
    },
    imageUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=500&q=80',
    reporterId: new mongoose.Types.ObjectId()
  },
  {
    title: 'Found Keys on Lanyard',
    description: 'Honda car keys on a red Supreme lanyard. Found on a bench.',
    category: 'Keys',
    type: 'found',
    status: 'Active',
    location: {
      type: 'Point',
      coordinates: [-73.985130, 40.758896],
      addressText: 'Times Square, NY'
    },
    imageUrl: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=500&q=80',
    reporterId: new mongoose.Types.ObjectId()
  },
  {
    title: 'Lost iPhone 14 Pro',
    description: 'Black iPhone 14 Pro with a clear case. Lock screen has a picture of a cat.',
    category: 'Electronics',
    type: 'lost',
    status: 'Active',
    location: {
      type: 'Point',
      coordinates: [-74.005974, 40.712776],
      addressText: 'Financial District, NY'
    },
    imageUrl: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=500&q=80',
    reporterId: new mongoose.Types.ObjectId()
  },
  {
    title: 'Found Blue Backpack',
    description: 'Jansport blue backpack. Found in the library study hall.',
    category: 'Accessories',
    type: 'found',
    status: 'Active',
    location: {
      type: 'Point',
      coordinates: [-73.962578, 40.807537],
      addressText: 'Columbia University Library'
    },
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80',
    reporterId: new mongoose.Types.ObjectId()
  }
];

async function seedDB() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    console.log('Clearing existing items...');
    await Item.deleteMany({});
    
    console.log(`Seeding ${sampleItems.length} items. This will take a moment to generate embeddings...`);
    
    // Process sequentially to avoid memory spikes with the local AI model
    for (const item of sampleItems) {
      console.log(`Processing: ${item.title}`);
      
      // Fetch the image buffer from the URL
      const response = await axios.get(item.imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      
      // Generate CLIP embedding locally
      const embedding = await generateImageEmbedding(buffer);
      
      // Save item
      await Item.create({
        ...item,
        embedding
      });
      console.log(`  -> Saved successfully.`);
    }
    
    console.log('Database seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedDB();

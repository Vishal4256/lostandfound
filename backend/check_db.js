require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Item = require('./models/Item');
  const count = await Item.countDocuments();
  const all = await Item.find({}, 'title type embedding').lean();
  const withEmbed = all.filter(i => i.embedding && i.embedding.length > 0).length;
  console.log('Total items in DB:', count);
  console.log('Items WITH embeddings:', withEmbed);
  all.forEach(i => console.log(' -', i.title, '| embed:', i.embedding ? i.embedding.length : 'NONE'));
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });

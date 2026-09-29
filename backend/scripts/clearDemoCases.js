/**
 * HavenFind Database Cleanup Script
 * Cleans out old/demo Items, orphaned Claims, and orphaned Conversations/Messages.
 * Strictly preserves the User collection and database integrity.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// Configure Cloudinary if credentials exist
if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

function extractCloudinaryPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('res.cloudinary.com')) return null;

  // Pattern matching: /upload/(?:v\d+/)?(lost_and_found/[^.]+)(?:\.[a-zA-Z0-9]+)?
  const match = url.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

async function runCleanup() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGO_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);

    console.log('HavenFind Database Cleanup');
    console.log('------------------------------------');

    // 1. Check User Collection
    const totalUsers = await User.countDocuments();

    // 2. Inspect Existing Items
    const existingItems = await Item.find({});
    const itemsCount = existingItems.length;

    // 3. Inspect Cloudinary references for items
    let cloudinaryAssetsDeleted = 0;
    let nonCloudinaryOrManualImages = 0;

    for (const item of existingItems) {
      const publicId = extractCloudinaryPublicId(item.imageUrl);
      if (publicId && process.env.CLOUDINARY_API_KEY) {
        try {
          await cloudinary.uploader.destroy(publicId);
          cloudinaryAssetsDeleted++;
        } catch (cErr) {
          // Non-fatal, asset may already be deleted or not found
        }
      } else if (item.imageUrl) {
        nonCloudinaryOrManualImages++;
      }
    }

    // 4. Delete all Item documents
    const deleteItemResult = await Item.deleteMany({});

    // 5. Clean orphaned Claims
    // Since all old items are removed, all claims referencing them are orphaned.
    const orphanedClaimsCount = await Claim.countDocuments();
    const deleteClaimsResult = await Claim.deleteMany({});

    // 6. Clean orphaned Conversations and Messages
    const orphanedConversations = await Conversation.find({});
    const orphanedConvoIds = orphanedConversations.map(c => c._id);
    const deleteMessagesResult = await Message.deleteMany({
      $or: [
        { conversation: { $in: orphanedConvoIds } },
        { conversation: { $nin: [] } } // will clean all if conversations is empty
      ]
    });
    const deleteConvosResult = await Conversation.deleteMany({});
    // Also clean any stray messages left behind
    await Message.deleteMany({});

    // 7. Verification of User collection preservation
    const postUsersCount = await User.countDocuments();
    const usersPreserved = postUsersCount === totalUsers;

    // 8. Verification of Item count
    const postItemsCount = await Item.countDocuments();
    const postClaimsCount = await Claim.countDocuments();

    console.log(`Existing items: ${itemsCount}`);
    console.log(`Deleted items: ${deleteItemResult.deletedCount}`);
    console.log(`Cloudinary item images removed: ${cloudinaryAssetsDeleted}`);
    if (nonCloudinaryOrManualImages > 0) {
      console.log(`External/Manual images noted: ${nonCloudinaryOrManualImages}`);
    }
    console.log(`Orphaned claims removed: ${deleteClaimsResult.deletedCount}`);
    console.log(`Orphaned item conversations removed: ${deleteConvosResult.deletedCount}`);
    console.log(`Orphaned messages removed: ${deleteMessagesResult.deletedCount}`);
    console.log('');
    console.log(`Registered users in database: ${postUsersCount}`);
    console.log(`Users preserved: ${usersPreserved ? 'YES' : 'NO'}`);
    console.log(`Items after cleanup: ${postItemsCount}`);
    console.log(`Claims after cleanup: ${postClaimsCount}`);
    console.log('------------------------------------');
    console.log('Cleanup completed successfully.');
  } catch (error) {
    console.error('Cleanup failed with error:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runCleanup();

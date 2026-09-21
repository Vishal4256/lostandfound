const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/upload');
const {
  getAllItems,
  createListing,
  getMyItems,
  searchVectorMatches,
  getItemById,
  updateItemStatus,
  deleteItem
} = require('../controllers/itemController');

// Public item feed & search
router.get('/', getAllItems);
router.post('/search', uploadSingle('image'), searchVectorMatches);
router.get('/my-items', protect, getMyItems);
router.get('/:id', getItemById);

// Protected actions
router.post('/', protect, uploadSingle('image'), createListing);
router.patch('/:id/status', protect, updateItemStatus);
router.delete('/:id', protect, deleteItem);

module.exports = router;

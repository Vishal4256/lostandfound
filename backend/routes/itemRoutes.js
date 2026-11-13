const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/upload');
const {
  getAllItems,
  createListing,
  getMyItems,
  searchVectorMatches,
  getItemStats,
  getItemById,
  reverseGeocode,
  updateItemStatus,
  updateItemDetails,
  confirmHandover,
  closeCase,
  reopenCase,
  deleteItem
} = require('../controllers/itemController');

// Public item feed, search & reverse geocoding
router.get('/', getAllItems);
router.get('/stats', getItemStats);
router.get('/reverse-geocode', reverseGeocode);
router.post('/search', uploadSingle('image'), searchVectorMatches);
router.get('/my-items', protect, getMyItems);
router.get('/:id', getItemById);

// Protected actions
router.post('/', protect, uploadSingle('image'), createListing);
router.patch('/:id/status', protect, updateItemStatus);
router.patch('/:id', protect, updateItemDetails);
router.post('/:id/handover', protect, confirmHandover);
router.post('/:id/close', protect, closeCase);
router.post('/:id/reopen', protect, reopenCase);
router.delete('/:id', protect, deleteItem);

module.exports = router;

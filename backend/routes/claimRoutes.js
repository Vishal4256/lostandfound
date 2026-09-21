const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/upload');
const {
  submitClaim,
  getItemClaims,
  getMyClaims,
  resolveClaim
} = require('../controllers/claimController');

// User's own submitted claims
router.get('/my-claims', protect, getMyClaims);

// Item specific claims (Reporter view)
router.get('/item/:itemId', protect, getItemClaims);

// Submit a claim on an item (supports both POST /api/claims and POST /api/claims/:itemId)
router.post('/', protect, uploadSingle('proofImage'), submitClaim);
router.post('/:itemId', protect, uploadSingle('proofImage'), submitClaim);

// Resolve claim (Approve / Reject by Reporter)
router.patch('/:claimId/resolve', protect, resolveClaim);
router.patch('/:claimId/status', protect, resolveClaim);

module.exports = router;

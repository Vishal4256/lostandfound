const express = require('express');
const router = express.Router();
const { handleRecoveryQuery } = require('../controllers/ragController');
const { protect } = require('../middleware/authMiddleware');
const { rateLimit } = require('../middleware/rateLimiter');

// Rate limiting: 20 AI recovery queries per 5 minutes per IP
const aiRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'AI Recovery query limit reached. Please wait a few moments before submitting another inquiry.'
});

// POST /api/ai/recovery - Protected RAG Recovery Assistant endpoint
router.post('/recovery', protect, aiRateLimiter, handleRecoveryQuery);

module.exports = router;

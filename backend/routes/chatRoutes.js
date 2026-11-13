const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const chatController = require('../controllers/chatController');

router.use(protect);

router.get('/unread-count', chatController.getUnreadCount);
router.get('/conversations', chatController.getUserConversations);
router.post('/conversations', chatController.getOrCreateConversation);
router.patch('/conversations/:id/read', chatController.markConversationAsRead);
router.get('/conversations/:id/messages', chatController.getMessages);
router.post('/conversations/:id/messages', chatController.sendMessage);

module.exports = router;

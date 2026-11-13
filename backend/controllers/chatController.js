const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Item = require('../models/Item');
const { createAndSendNotification } = require('../services/notificationService');

// In-memory sliding window rate limiter: 60 messages per minute per user
const messageRateMap = new Map();
function isRateLimited(userId) {
  const now = Date.now();
  const uid = userId.toString();
  const timestamps = messageRateMap.get(uid) || [];
  const windowStart = now - 60000;
  const recent = timestamps.filter(t => t > windowStart);
  if (recent.length >= 60) {
    return true;
  }
  recent.push(now);
  messageRateMap.set(uid, recent);
  return false;
}

/**
 * Get all conversations for the authenticated user
 * Route: GET /api/chat/conversations
 */
exports.getUserConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const conversations = await Conversation.find({
      participants: userId
    })
      .populate('participants', 'name email avatar')
      .populate('item', 'title imageUrl category type status')
      .populate('claim', 'status proofDetails decisionReason')
      .sort({ lastMessageAt: -1 });

    // Compute unread counts per conversation for current user
    const formatted = await Promise.all(conversations.map(async (conv) => {
      const convObj = conv.toObject();
      const count = await Message.countDocuments({
        conversation: conv._id,
        sender: { $ne: userId },
        read: false
      });
      convObj.computedUnreadCount = count;
      return convObj;
    }));

    res.status(200).json({ success: true, conversations: formatted });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, message: 'Server error fetching conversations' });
  }
};

/**
 * Get total unread message count across all conversations for current user
 * Route: GET /api/chat/unread-count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const userConversations = await Conversation.find({ participants: userId }).select('_id');
    const convIds = userConversations.map(c => c._id);

    const unreadCount = await Message.countDocuments({
      conversation: { $in: convIds },
      sender: { $ne: userId },
      read: false
    });

    res.status(200).json({ success: true, count: unreadCount, unreadCount });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ success: false, message: 'Server error getting unread count' });
  }
};

/**
 * Mark all unread messages in a conversation as read
 * Route: PATCH /api/chat/conversations/:id/read
 */
exports.markConversationAsRead = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversation ID' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(p => p.toString() === userId.toString());
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Not authorized for this conversation' });
    }

    // Mark unread messages sent by others as read
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        read: false
      },
      { $set: { read: true } }
    );

    if (conversation.unreadCount) {
      conversation.unreadCount.set(userId.toString(), 0);
      await conversation.save();
    }

    if (req.io) {
      req.io.to(conversationId.toString()).emit('conversation_read', {
        conversationId: conversationId.toString(),
        userId: userId.toString()
      });
      req.io.to(`user_${userId.toString()}`).emit('conversation_read', {
        conversationId: conversationId.toString(),
        userId: userId.toString()
      });
    }

    res.status(200).json({ success: true, message: 'Conversation marked as read' });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({ success: false, message: 'Server error marking conversation as read' });
  }
};

/**
 * Get or create a conversation for a specific item and participants
 * Route: POST /api/chat/conversations
 * Body: { itemId, recipientId, claimId }
 */
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { itemId, recipientId, claimId } = req.body;
    const userId = req.user._id;

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: 'Valid itemId is required' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Default recipient is the item's reporter if not provided
    let rawRecipient = recipientId || item.reportedBy || item.reporterId;
    const targetRecipientId = (rawRecipient && typeof rawRecipient === 'object' && rawRecipient._id)
      ? rawRecipient._id.toString()
      : rawRecipient?.toString();

    if (!targetRecipientId || !mongoose.Types.ObjectId.isValid(targetRecipientId)) {
      return res.status(400).json({ success: false, message: 'Valid recipient not found for this item' });
    }

    if (userId.toString() === targetRecipientId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot start a conversation with yourself' });
    }

    // Check if conversation already exists for this item and these two users
    let conversation = await Conversation.findOne({
      item: itemId,
      participants: { $all: [userId, targetRecipientId], $size: 2 }
    })
      .populate('participants', 'name email avatar')
      .populate('item', 'title imageUrl category type status')
      .populate('claim', 'status proofDetails decisionReason');

    if (!conversation) {
      conversation = await Conversation.create({
        item: itemId,
        participants: [userId, targetRecipientId],
        claim: claimId && mongoose.Types.ObjectId.isValid(claimId) ? claimId : null,
        conversationType: claimId ? 'claim_coordination' : 'inquiry',
        lastMessage: 'Conversation started',
        lastMessageAt: new Date()
      });

      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'name email avatar')
        .populate('item', 'title imageUrl category type status')
        .populate('claim', 'status proofDetails decisionReason');
    } else if (claimId && !conversation.claim && mongoose.Types.ObjectId.isValid(claimId)) {
      conversation.claim = claimId;
      conversation.conversationType = 'claim_coordination';
      await conversation.save();
      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'name email avatar')
        .populate('item', 'title imageUrl category type status')
        .populate('claim', 'status proofDetails decisionReason');
    }

    res.status(200).json({ success: true, conversation });
  } catch (error) {
    console.error('Error in getOrCreateConversation:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error with conversation' });
  }
};

/**
 * Get messages for a specific conversation
 * Route: GET /api/chat/conversations/:id/messages
 */
exports.getMessages = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversation ID format' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(p => p.toString() === userId.toString());
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Not authorized for this conversation' });
    }

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'name email avatar')
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Server error fetching messages' });
  }
};

/**
 * Send a message in a conversation
 * Route: POST /api/chat/conversations/:id/messages
 * Body: { text }
 */
exports.sendMessage = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user._id;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversation ID format' });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    if (text.trim().length > 2000) {
      return res.status(400).json({ success: false, message: 'Message cannot exceed 2000 characters' });
    }

    if (isRateLimited(userId)) {
      return res.status(429).json({
        success: false,
        message: 'Message limit reached. Please wait a moment before sending another message.'
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(p => p.toString() === userId.toString());
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Not authorized for this conversation' });
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      text: text.trim(),
      read: false
    });

    conversation.lastMessage = text.trim();
    conversation.lastMessageAt = new Date();

    if (!conversation.unreadCount) {
      conversation.unreadCount = new Map();
    }
    conversation.participants.forEach(p => {
      const pId = p.toString();
      if (pId !== userId.toString()) {
        const current = conversation.unreadCount.get(pId) || 0;
        conversation.unreadCount.set(pId, current + 1);
      }
    });

    await conversation.save();

    const populated = await Message.findById(message._id).populate('sender', 'name email avatar');
    const messagePayload = populated.toObject();
    messagePayload.conversationId = conversationId.toString();

    // If req.io is attached, emit real-time event to the room AND participants
    if (req.io) {
      req.io.to(conversationId.toString()).emit('new_message', messagePayload);
      if (Array.isArray(conversation.participants)) {
        conversation.participants.forEach((p) => {
          const pId = (p._id || p)?.toString();
          if (pId) {
            req.io.to(`user_${pId}`).emit('new_message', messagePayload);
            req.io.to(`user_${pId}`).emit('conversation_updated', {
              conversationId: conversationId.toString(),
              lastMessage: text.trim(),
              lastMessageAt: conversation.lastMessageAt
            });
            if (pId !== userId.toString()) {
              createAndSendNotification(req.io, {
                recipient: pId,
                sender: userId,
                type: 'new_message',
                title: `New message from ${req.user.name || 'Citizen'}`,
                message: text.trim().slice(0, 100),
                item: conversation.item,
                link: `/item/${conversation.item}?action=chat&convoId=${conversationId}`
              }).catch(() => {});
            }
          }
        });
      }
    }

    res.status(201).json({ success: true, message: messagePayload });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Server error sending message' });
  }
};

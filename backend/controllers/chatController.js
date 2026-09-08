const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Item = require('../models/Item');

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
      .sort({ lastMessageAt: -1 });

    res.json({ success: true, conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, message: 'Server error fetching conversations' });
  }
};

/**
 * Get or create a conversation for a specific item and participants
 * Route: POST /api/chat/conversations
 * Body: { itemId, recipientId }
 */
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { itemId, recipientId } = req.body;
    const userId = req.user._id;

    if (!itemId) {
      return res.status(400).json({ success: false, message: 'itemId is required' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Default recipient is the item's reporter if not provided
    const targetRecipientId = recipientId || item.reporterId;

    if (!targetRecipientId) {
      return res.status(400).json({ success: false, message: 'Recipient not found for this item' });
    }

    // Check if conversation already exists for this item and these two users
    let conversation = await Conversation.findOne({
      item: itemId,
      participants: { $all: [userId, targetRecipientId] }
    })
      .populate('participants', 'name email avatar')
      .populate('item', 'title imageUrl category type status');

    if (!conversation) {
      conversation = await Conversation.create({
        item: itemId,
        participants: [userId, targetRecipientId],
        lastMessage: 'Conversation started',
        lastMessageAt: new Date()
      });

      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'name email avatar')
        .populate('item', 'title imageUrl category type status');
    }

    res.json({ success: true, conversation });
  } catch (error) {
    console.error('Error in getOrCreateConversation:', error);
    res.status(500).json({ success: false, message: 'Server error with conversation' });
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

    res.json({ success: true, messages });
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

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
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
      text: text.trim()
    });

    conversation.lastMessage = text.trim();
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populated = await Message.findById(message._id).populate('sender', 'name email avatar');

    // If req.io is attached, emit real-time event to the room
    if (req.io) {
      req.io.to(conversationId).emit('new_message', populated);
    }

    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Server error sending message' });
  }
};

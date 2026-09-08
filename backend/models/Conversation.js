const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now },
  unreadCount: { type: Map, of: Number, default: {} }, // userId -> unread count
}, { timestamps: true });

// Unique conversation per item + participant pair
conversationSchema.index({ item: 1, participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);

const Notification = require('../models/Notification');

/**
 * Creates a notification in MongoDB and broadcasts it in real-time via Socket.IO
 */
async function createAndSendNotification(io, { recipient, sender, type, title, message, item, claim, link }) {
  if (!recipient) return null;
  const recipientId = (recipient._id || recipient).toString();
  const senderId = sender ? (sender._id || sender).toString() : null;

  // Never notify user of their own actions
  if (senderId && recipientId === senderId) return null;

  try {
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      type,
      title: title.trim(),
      message: message.trim(),
      item: item ? (item._id || item) : undefined,
      claim: claim ? (claim._id || claim) : undefined,
      link: link || (item ? `/item/${(item._id || item)}` : '/dashboard'),
      read: false
    });

    const populated = await Notification.findById(notification._id)
      .populate('sender', 'name email avatar')
      .populate('item', 'title imageUrl status');

    if (io) {
      io.to(`user_${recipientId}`).emit('new_notification', populated);
    }

    return populated;
  } catch (err) {
    console.error('Notification creation error:', err.message);
    return null;
  }
}

module.exports = {
  createAndSendNotification
};


const mongoose = require('mongoose');
const Notification = require('../models/Notification');

/**
 * Get recent notifications for the authenticated user
 * Route: GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const notifications = await Notification.find({ recipient: userId })
      .populate('sender', 'name email avatar')
      .populate('item', 'title imageUrl status')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      read: false
    });

    res.status(200).json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Server error fetching notifications' });
  }
};

/**
 * Get unread notification count for the authenticated user
 * Route: GET /api/notifications/unread-count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const count = await Notification.countDocuments({
      recipient: userId,
      read: false
    });

    res.status(200).json({ success: true, count, unreadCount: count });
  } catch (error) {
    console.error('Error getting notification unread count:', error);
    res.status(500).json({ success: false, message: 'Server error getting unread count' });
  }
};

/**
 * Mark a single notification as read
 * Route: PATCH /api/notifications/:id/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (req.io) {
      req.io.to(`user_${userId}`).emit('notification_read', { notificationId: id });
    }

    res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Server error updating notification' });
  }
};

/**
 * Mark all notifications as read for current user
 * Route: PATCH /api/notifications/read-all
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    await Notification.updateMany(
      { recipient: userId, read: false },
      { $set: { read: true } }
    );

    if (req.io) {
      req.io.to(`user_${userId}`).emit('all_notifications_read', { userId: userId.toString() });
    }

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Server error marking notifications read' });
  }
};


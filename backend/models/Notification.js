const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: {
    type: String,
    enum: [
      'claim_submitted',
      'claim_approved',
      'claim_rejected',
      'claim_info_requested',
      'claim_info_responded',
      'item_reunited',
      'case_closed',
      'new_message'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  claim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim' },
  link: { type: String, default: '/' },
  read: { type: Boolean, default: false, index: true }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);


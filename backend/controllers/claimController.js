const mongoose = require('mongoose');
const Claim = require('../models/Claim');
const Item = require('../models/Item');
const Conversation = require('../models/Conversation');
const { createAndSendNotification } = require('../services/notificationService');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: folder, resource_type: 'image' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

/**
 * Submit an ownership claim for an item
 * Route: POST /api/claims/:itemId
 */
exports.submitClaim = async (req, res) => {
  try {
    const itemId = req.params.itemId || req.body.itemId;
    const { proofDetails } = req.body;

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: 'Valid item ID is required' });
    }

    if (!proofDetails || typeof proofDetails !== 'string' || !proofDetails.trim()) {
      return res.status(400).json({ success: false, message: 'Proof details describing your ownership are required' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (item.status === 'Resolved' || item.status === 'Closed') {
      return res.status(400).json({
        success: false,
        message: 'This case is already concluded and cannot receive new claims.'
      });
    }

    const itemAuthorId = (item.reportedBy || item.reporterId)?.toString();
    if (itemAuthorId && itemAuthorId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot submit a claim for an item you reported.' });
    }

    // Check for existing active pending or info_requested claim by this user
    const existingClaim = await Claim.findOne({
      item: itemId,
      claimant: req.user._id,
      status: { $in: ['pending', 'info_requested', 'approved'] }
    });

    if (existingClaim) {
      return res.status(409).json({
        success: false,
        message: `You already have a claim on record for this item (Status: ${existingClaim.status}).`
      });
    }

    let proofImage = '';
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, 'lost_and_found_claims');
        proofImage = uploadResult.secure_url;
      } catch (uploadErr) {
        console.error('Proof image upload error:', uploadErr);
        return res.status(500).json({ success: false, message: 'Failed to upload proof image' });
      }
    }

    const claim = await Claim.create({
      item: itemId,
      claimant: req.user._id,
      proofDetails: proofDetails.trim(),
      proofImage,
      status: 'pending'
    });

    // Update item status and statusHistory
    if (item.status === 'Active') {
      item.status = 'Pending Claim';
    }
    item.statusHistory = item.statusHistory || [];
    item.statusHistory.push({
      status: 'Pending Claim',
      changedAt: new Date(),
      changedBy: req.user._id,
      note: 'Ownership verification claim submitted by citizen.'
    });
    await item.save();

    // Auto-link or create case conversation with claim
    try {
      let conversation = await Conversation.findOne({
        item: itemId,
        participants: { $all: [req.user._id, itemAuthorId], $size: 2 }
      });

      if (!conversation) {
        conversation = await Conversation.create({
          item: itemId,
          participants: [req.user._id, itemAuthorId],
          claim: claim._id,
          conversationType: 'claim_coordination',
          lastMessage: `Claim submitted by ${req.user.name || 'claimant'}.`,
          lastMessageAt: new Date()
        });
      } else {
        conversation.claim = claim._id;
        conversation.conversationType = 'claim_coordination';
        await conversation.save();
      }

      if (req.io && itemAuthorId) {
        req.io.to(`user_${itemAuthorId}`).emit('new_claim_notification', {
          claimId: claim._id,
          itemId,
          itemTitle: item.title,
          claimantName: req.user.name,
          createdAt: claim.createdAt
        });
      }
    } catch (convErr) {
      console.warn('Auto conversation link warning:', convErr.message);
    }

    const populatedClaim = await Claim.findById(claim._id)
      .populate('claimant', 'name email avatar')
      .populate('item', 'title category itemType type imageUrl status');

    if (req.io) {
      const claimPayload = {
        claim: populatedClaim,
        itemId: item._id.toString(),
        itemStatus: item.status,
        claimant: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          avatar: req.user.avatar
        }
      };

      // Real-time synchronization to reporter and case viewer
      if (itemAuthorId) {
        req.io.to(`user_${itemAuthorId}`).emit('claim_submitted', claimPayload);
      }
      req.io.to(`case_${item._id}`).emit('claim_submitted', claimPayload);

      // Real-time item status update
      req.io.to(`case_${item._id}`).emit('item_status_updated', {
        itemId: item._id.toString(),
        status: item.status
      });
      req.io.emit('item_status_updated', {
        itemId: item._id.toString(),
        status: item.status
      });

      // Persistent Notification in MongoDB for reporter
      if (itemAuthorId) {
        await createAndSendNotification(req.io, {
          recipient: itemAuthorId,
          sender: req.user._id,
          type: 'claim_submitted',
          title: 'New Ownership Claim Submitted',
          message: `${req.user.name || 'A citizen'} submitted an ownership claim for "${item.title}".`,
          item: item._id,
          claim: claim._id,
          link: `/item/${item._id}?action=claims`
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Claim submitted successfully. The item reporter will review your proof.',
      claim: populatedClaim
    });
  } catch (error) {
    console.error('Error submitting claim:', error);
    res.status(500).json({ success: false, message: 'Server error while submitting claim' });
  }
};

/**
 * Get all claims for a specific item (reporter or admin only)
 * Route: GET /api/claims/item/:itemId
 */
exports.getItemClaims = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid item ID format' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const itemAuthorId = (item.reportedBy || item.reporterId)?.toString();
    const isReporter = itemAuthorId === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isReporter && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only the item reporter or administrator can view ownership claims.' });
    }

    const claims = await Claim.find({ item: itemId })
      .populate('claimant', 'name email avatar createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: claims.length,
      claims
    });
  } catch (error) {
    console.error('Error fetching item claims:', error);
    res.status(500).json({ success: false, message: 'Server error fetching claims' });
  }
};

/**
 * Get all claims submitted by the logged-in user
 * Route: GET /api/claims/my-claims
 */
exports.getMyClaims = async (req, res) => {
  try {
    const claims = await Claim.find({ claimant: req.user._id })
      .populate({
        path: 'item',
        select: 'title category itemType type imageUrl status location date reportedBy reporterId',
        populate: {
          path: 'reportedBy',
          select: 'name email avatar'
        }
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: claims.length,
      claims
    });
  } catch (error) {
    console.error('Error fetching user claims:', error);
    res.status(500).json({ success: false, message: 'Server error fetching your claims' });
  }
};

/**
 * Approve or reject an ownership claim
 * Route: PATCH /api/claims/:claimId/resolve
 */
exports.resolveClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { status, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(claimId)) {
      return res.status(400).json({ success: false, message: 'Invalid claim ID format' });
    }

    if (!status || !['approved', 'rejected'].includes(status.toLowerCase())) {
      return res.status(400).json({ success: false, message: "Valid status required: 'approved' or 'rejected'" });
    }

    const claim = await Claim.findById(claimId).populate('item');
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    const item = await Item.findById(claim.item._id || claim.item);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Associated item not found' });
    }

    const itemAuthorId = (item.reportedBy || item.reporterId)?.toString();
    const isReporter = itemAuthorId === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isReporter && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only the item reporter or administrator can resolve this claim' });
    }

    // Prevent claimant from resolving their own claim even in edge cases
    if (claim.claimant.toString() === req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Claimant cannot approve or reject their own claim' });
    }

    // A claim that is already decided cannot be modified again
    if (claim.status === 'approved' || claim.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: `Claim has already been ${claim.status} and cannot be modified.`
      });
    }

    // An item that is already resolved or closed cannot accept another approved claim
    if (status.toLowerCase() === 'approved' && (item.status === 'Resolved' || item.status === 'Closed')) {
      return res.status(400).json({
        success: false,
        message: 'This item has already been marked as Reunited/Closed and cannot accept another approved claim.'
      });
    }

    claim.status = status.toLowerCase();
    claim.decisionReason = (reason || '').trim();
    claim.reviewedBy = req.user._id;
    claim.reviewedAt = new Date();
    await claim.save();

    item.statusHistory = item.statusHistory || [];

    // If approved, transition item to 'Handover Pending'
    if (claim.status === 'approved') {
      item.status = 'Handover Pending';
      item.statusHistory.push({
        status: 'Handover Pending',
        changedAt: new Date(),
        changedBy: req.user._id,
        note: reason ? `Claim approved: ${reason.trim()}` : 'Ownership claim approved. Awaiting item handover coordination.'
      });
      await item.save();

      // Find other pending claimants to notify them in real time
      const otherClaims = await Claim.find({
        item: item._id,
        _id: { $ne: claim._id },
        status: { $in: ['pending', 'info_requested'] }
      }).select('claimant _id');

      // Automatically reject any other pending or info-requested claims for this item
      await Claim.updateMany(
        { item: item._id, _id: { $ne: claim._id }, status: { $in: ['pending', 'info_requested'] } },
        {
          status: 'rejected',
          decisionReason: 'Another verified claim was approved for this item.',
          reviewedBy: req.user._id,
          reviewedAt: new Date()
        }
      );

      // Notify other claimants in real time
      if (req.io && otherClaims.length > 0) {
        for (const oc of otherClaims) {
          const ocId = (oc.claimant?._id || oc.claimant)?.toString();
          if (ocId) {
            req.io.to(`user_${ocId}`).emit('claim_status_updated', {
              claimId: oc._id,
              itemId: item._id,
              status: 'rejected',
              reason: 'Another verified claim was approved for this item.',
              itemStatus: item.status
            });
            await createAndSendNotification(req.io, {
              recipient: ocId,
              sender: req.user._id,
              type: 'claim_rejected',
              title: 'Claim Update: Case Concluded',
              message: `Another verified claim was approved for "${item.title}". Your claim was concluded.`,
              item: item._id,
              claim: oc._id,
              link: `/item/${item._id}`
            });
          }
        }
      }
    } else if (claim.status === 'rejected') {
      // If no other pending/approved claims exist, restore item status to Active if it was Pending Claim
      const activePending = await Claim.countDocuments({
        item: item._id,
        status: { $in: ['pending', 'info_requested', 'approved'] }
      });
      if (activePending === 0 && (item.status === 'Pending Claim' || item.status === 'Handover Pending')) {
        item.status = 'Active';
        item.statusHistory.push({
          status: 'Active',
          changedAt: new Date(),
          changedBy: req.user._id,
          note: 'Claim rejected. Item returned to active search directory.'
        });
        await item.save();
      }
    }

    const updatedClaim = await Claim.findById(claimId)
      .populate('claimant', 'name email avatar')
      .populate('item', 'title status');

    if (req.io) {
      const claimantId = (claim.claimant._id || claim.claimant)?.toString();
      const payload = {
        claimId: claim._id,
        itemId: item._id,
        status: claim.status,
        reason: claim.decisionReason,
        itemStatus: item.status,
        claim: updatedClaim
      };

      if (claimantId) {
        req.io.to(`user_${claimantId}`).emit('claim_status_updated', payload);
      }
      req.io.to(`case_${item._id}`).emit('claim_status_updated', payload);

      // Broadcast item status update
      req.io.to(`case_${item._id}`).emit('item_status_updated', {
        itemId: item._id.toString(),
        status: item.status
      });
      req.io.emit('item_status_updated', {
        itemId: item._id.toString(),
        status: item.status
      });

      // Persistent Notification in MongoDB for claimant
      if (claimantId) {
        const isApproved = claim.status === 'approved';
        await createAndSendNotification(req.io, {
          recipient: claimantId,
          sender: req.user._id,
          type: isApproved ? 'claim_approved' : 'claim_rejected',
          title: isApproved ? 'Ownership Claim Approved! 🎉' : 'Claim Verification Decision',
          message: isApproved
            ? `Your ownership claim for "${item.title}" has been approved! You can now coordinate the safe handover with the reporter.`
            : `Your claim for "${item.title}" was rejected: ${claim.decisionReason || 'Insufficient proof provided.'}`,
          item: item._id,
          claim: claim._id,
          link: `/item/${item._id}?action=claim`
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Claim successfully ${claim.status}`,
      claim: updatedClaim,
      itemStatus: item.status
    });
  } catch (error) {
    console.error('Error resolving claim:', error);
    res.status(500).json({ success: false, message: 'Server error while resolving claim' });
  }
};

/**
 * Request additional information from a claimant
 * Route: POST /api/claims/:claimId/request-info
 */
exports.requestClaimInfo = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message describing required information is required.' });
    }

    const claim = await Claim.findById(claimId).populate('item');
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    const item = await Item.findById(claim.item._id || claim.item);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Associated item not found' });
    }

    const itemAuthorId = (item.reportedBy || item.reporterId)?.toString();
    const isReporter = itemAuthorId === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isReporter && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only the item reporter or administrator can request additional proof.' });
    }

    claim.status = 'info_requested';
    claim.infoRequestedMessage = message.trim();
    claim.reviewedBy = req.user._id;
    claim.reviewedAt = new Date();
    await claim.save();

    if (req.io && claim.claimant) {
      const claimantId = (claim.claimant._id || claim.claimant).toString();
      const payload = {
        claimId: claim._id,
        itemId: item._id,
        message: message.trim(),
        claim
      };

      req.io.to(`user_${claimantId}`).emit('claim_info_requested', payload);
      req.io.to(`case_${item._id}`).emit('claim_info_requested', payload);

      await createAndSendNotification(req.io, {
        recipient: claimantId,
        sender: req.user._id,
        type: 'claim_info_requested',
        title: 'Additional Information Requested',
        message: `Reporter requested additional proof for "${item.title}": ${message.trim()}`,
        item: item._id,
        claim: claim._id,
        link: `/item/${item._id}`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Request for additional verification information sent to claimant.',
      claim
    });
  } catch (error) {
    console.error('Error requesting claim info:', error);
    res.status(500).json({ success: false, message: 'Server error requesting more information' });
  }
};

/**
 * Respond to an information request (Claimant action)
 * Route: POST /api/claims/:claimId/respond
 */
exports.respondToClaimInfo = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { response } = req.body;

    if (!response || !response.trim()) {
      return res.status(400).json({ success: false, message: 'Response details are required.' });
    }

    const claim = await Claim.findById(claimId);
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    if (claim.claimant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the claimant can respond to this information request.' });
    }

    claim.claimantResponse = response.trim();
    claim.status = 'pending';
    await claim.save();

    const populatedClaim = await Claim.findById(claimId)
      .populate('claimant', 'name email avatar')
      .populate('item', 'title status');

    const item = await Item.findById(claim.item._id || claim.item);
    const reporterId = (item?.reportedBy || item?.reporterId)?.toString();

    if (req.io) {
      const payload = {
        claimId: claim._id,
        itemId: item ? item._id : null,
        claimantResponse: response.trim(),
        claim: populatedClaim
      };

      if (reporterId) {
        req.io.to(`user_${reporterId}`).emit('claim_info_responded', payload);
      }
      if (item?._id) {
        req.io.to(`case_${item._id}`).emit('claim_info_responded', payload);
      }

      if (reporterId && item) {
        await createAndSendNotification(req.io, {
          recipient: reporterId,
          sender: req.user._id,
          type: 'claim_info_responded',
          title: 'Claimant Provided Additional Info',
          message: `${req.user.name || 'Claimant'} responded to your proof request for "${item.title}".`,
          item: item._id,
          claim: claim._id,
          link: `/item/${item._id}?action=claims`
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Additional verification details submitted for review.',
      claim: populatedClaim
    });
  } catch (error) {
    console.error('Error responding to claim info:', error);
    res.status(500).json({ success: false, message: 'Server error submitting additional information' });
  }
};

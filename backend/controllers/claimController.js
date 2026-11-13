const mongoose = require('mongoose');
const Claim = require('../models/Claim');
const Item = require('../models/Item');
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

    const populatedClaim = await Claim.findById(claim._id)
      .populate('claimant', 'name email avatar')
      .populate('item', 'title category itemType type imageUrl status');

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

    res.status(200).json({
      success: true,
      message: 'Additional verification details submitted for review.',
      claim
    });
  } catch (error) {
    console.error('Error responding to claim info:', error);
    res.status(500).json({ success: false, message: 'Server error submitting additional information' });
  }
};

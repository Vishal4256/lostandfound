/**
 * ragController.js
 * 
 * Controller for HavenFind RAG AI Recovery Assistant
 */

const { processRagQuery } = require('../services/ragService');

/**
 * Executes a natural language RAG recovery query against HavenFind registry
 * Route: POST /api/ai/recovery
 * Access: Private (Authenticated users)
 */
exports.handleRecoveryQuery = async (req, res) => {
  try {
    const { query, conversationHistory } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A descriptive search query is required.'
      });
    }

    if (query.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Query cannot exceed 500 characters.'
      });
    }

    const result = await processRagQuery({
      query: query.trim(),
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory.slice(-4) : []
    });

    return res.status(200).json({
      success: true,
      answer: result.answer,
      matches: result.matches,
      retrievedCount: result.retrievedCount,
      query: result.query
    });
  } catch (error) {
    console.error('RAG Recovery Controller Error:', error);
    return res.status(500).json({
      success: false,
      message: 'The HavenFind AI Recovery Assistant is temporarily unavailable. Please try again or browse listings directly.'
    });
  }
};

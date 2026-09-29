/**
 * ragService.js
 * 
 * Production RAG (Retrieval-Augmented Generation) Service for HavenFind.
 * Combines Multimodal CLIP Vector Retrieval + Keyword/Geo Filtering + Google Gemini LLM Generation.
 * 
 * Pipeline:
 * User Query -> CLIP Text Vector + Keyword Extraction -> MongoDB Registry Candidates
 *   -> Hybrid Vector/Text Re-ranking -> Top K Safe Public Records -> Grounded Context
 *   -> Google Gemini API -> Grounded Answer + Real Item Links
 */

const Item = require('../models/Item');
const { generateTextEmbedding } = require('./embeddingService');
const { GoogleGenAI } = require('@google/genai');

/**
 * Stopwords to filter out when extracting semantic keywords
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your',
  'he', 'she', 'it', 'they', 'them', 'this', 'that', 'these', 'those',
  'am', 'about', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while',
  'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
  'lost', 'found', 'looking', 'searching', 'anyone', 'someone', 'please', 'help'
]);

/**
 * Computes cosine similarity between two float vectors
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? Math.max(0, dot / denominator) : 0;
}

/**
 * Extracts salient search terms from a natural language query
 */
function extractSearchTokens(query) {
  if (!query || typeof query !== 'string') return [];
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 3 && !STOPWORDS.has(token));
}

/**
 * Determines intended item search type from natural language phrasing
 * e.g., "I lost my phone" -> looking for 'found' items
 *       "I found a cat" -> looking for 'lost' items
 */
function detectIntentType(query) {
  const q = query.toLowerCase();
  if (/\b(lost|misplaced|missing|left behind|dropped)\b/.test(q)) {
    return 'found'; // User lost something, so they want to find what has been turned in
  }
  if (/\b(found|picked up|discovered|turned in)\b/.test(q)) {
    return 'lost'; // User found something, checking if owner reported it lost
  }
  return null; // Search all active items
}

/**
 * Retrieves Top-K relevant public items using hybrid vector + keyword scoring
 * 
 * @param {string} query - User natural language query
 * @param {number} topK - Maximum number of candidates to return (default: 5)
 * @returns {Promise<Array>} - Ranked candidate items with scores and reasons
 */
async function retrieveRelevantItems(query, topK = 5) {
  try {
    const searchTokens = extractSearchTokens(query);
    const intentType = detectIntentType(query);

    // 1. Generate 512-D CLIP text embedding for vector matching
    let queryEmbedding = null;
    try {
      queryEmbedding = await generateTextEmbedding(query);
    } catch (embErr) {
      console.warn('[RAG Retriever] CLIP text embedding generation failed, using keyword matching only:', embErr.message);
    }

    // 2. Build MongoDB query filter (strictly active items only)
    const filter = { status: 'Active' };
    if (intentType) {
      filter.$or = [{ type: intentType }, { itemType: intentType }];
    }

    // Fetch candidate records - EXCLUDE confidential fields strictly
    const candidates = await Item.find(filter)
      .select('title description category subCategory type itemType location imageUrl date status embedding _id')
      .lean();

    if (!candidates || candidates.length === 0) {
      return [];
    }

    // 3. Compute hybrid scores for each candidate
    const scoredCandidates = candidates.map(item => {
      // A. Vector similarity (CLIP text-to-image cosine similarity)
      let vectorScore = 0;
      if (queryEmbedding && item.embedding && item.embedding.length === queryEmbedding.length) {
        vectorScore = cosineSimilarity(queryEmbedding, item.embedding);
      }

      // B. Keyword & lexical relevance score
      let keywordHits = 0;
      const searchableText = [
        item.title || '',
        item.description || '',
        item.category || '',
        item.subCategory || '',
        item.location?.addressText || ''
      ].join(' ').toLowerCase();

      searchTokens.forEach(token => {
        if (searchableText.includes(token)) {
          keywordHits++;
        }
      });

      const keywordScore = searchTokens.length > 0 ? (keywordHits / searchTokens.length) : 0;

      // C. Hybrid fusion score
      // If vector score exists, weight vector 65% and keyword 35%
      const hybridScore = queryEmbedding
        ? (vectorScore * 0.65) + (keywordScore * 0.35)
        : keywordScore;

      // Derive human-readable matching rationale
      const matchingReasons = [];
      if (keywordHits > 0) {
        matchingReasons.push(`${keywordHits} matching term(s) in title/description`);
      }
      if (vectorScore > 0.22) {
        matchingReasons.push(`High visual vector similarity (${(vectorScore * 100).toFixed(0)}%)`);
      }
      if (matchingReasons.length === 0 && hybridScore > 0.18) {
        matchingReasons.push('General contextual match');
      }

      return {
        itemId: item._id.toString(),
        title: item.title,
        description: item.description || '',
        category: item.category || 'Other',
        type: item.type || item.itemType || 'found',
        location: item.location?.addressText || 'Municipal Registry Area',
        imageUrl: item.imageUrl || '',
        date: item.date ? new Date(item.date).toISOString().split('T')[0] : 'Recent',
        score: parseFloat(hybridScore.toFixed(3)),
        vectorScore: parseFloat(vectorScore.toFixed(3)),
        reason: matchingReasons.join(' • ') || 'Potential registry match'
      };
    });

    // 4. Filter by minimum relevance threshold and rank Top K
    const threshold = queryEmbedding ? 0.20 : 0.10;
    const rankedMatches = scoredCandidates
      .filter(item => item.score >= threshold || item.vectorScore >= 0.22)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return rankedMatches;
  } catch (error) {
    console.error('[RAG Retriever Error]:', error);
    return [];
  }
}

/**
 * Builds grounded context for the LLM from retrieved records
 */
function buildGroundedContext(query, records) {
  if (!records || records.length === 0) {
    return 'NO RELEVANT HAVENFIND REGISTRY RECORDS FOUND IN DATABASE.';
  }

  const recordBlocks = records.map((rec, index) => {
    return `[RECORD ${index + 1}]
Item ID: ${rec.itemId}
Title: ${rec.title}
Listing Type: ${rec.type.toUpperCase()}
Category: ${rec.category}
Location: ${rec.location}
Date Reported: ${rec.date}
Description: ${rec.description || 'No additional public notes provided.'}
Relevance Score: ${rec.score}
Matched Features: ${rec.reason}`;
  }).join('\n\n');

  return `HAVENFIND RETRIEVED CIVIC REGISTRY RECORDS (${records.length} matches):\n\n${recordBlocks}`;
}

/**
 * Executes full RAG generation pipeline
 * 
 * @param {Object} params
 * @param {string} params.query - User natural language query
 * @param {Array} [params.conversationHistory] - Optional previous conversation turns
 * @returns {Promise<Object>} - Grounded response and matching items
 */
async function processRagQuery({ query, conversationHistory = [] }) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      answer: 'Please describe the lost or found property you are inquiring about.',
      matches: [],
      retrievedCount: 0
    };
  }

  const cleanQuery = query.trim();

  // 1. Retrieve candidates from real MongoDB registry
  const retrievedMatches = await retrieveRelevantItems(cleanQuery, 5);
  const groundedContext = buildGroundedContext(cleanQuery, retrievedMatches);

  // 2. Prepare Gemini Prompt & Grounding Instructions
  const systemInstruction = `You are the HavenFind AI Recovery Assistant for HavenFind (Civic Lost & Found Recovery Network).
Your role is to assist citizens in identifying whether their lost or found property has been recorded in the civic registry.

CRITICAL GROUNDING RULES:
1. Base your response EXCLUSIVELY on the retrieved HavenFind registry records provided in the context below.
2. If NO records were found or the context says "NO RELEVANT HAVENFIND REGISTRY RECORDS FOUND", state clearly and politely that no matching public reports were found in the HavenFind registry. Suggest refining the search with brand, color, specific area, or filing a new Lost/Found report via the "Submit Item" button.
3. NEVER invent, imagine, or hallucinate case numbers, items, users, locations, dates, or details.
4. When mentioning an item, refer to its exact Title, Type (LOST or FOUND), Location, and Item ID from the records.
5. NEVER claim that an item is definitively the user's property; state that it is a potential match they should review.
6. NEVER reveal, ask for, or attempt to guess confidential verification markers (e.g. hidden serial numbers, secret engravings).
7. Format your response cleanly using concise Markdown with bold highlights and bullet points.`;

  const promptContent = `Retrieved Registry Context:
${groundedContext}

User Inquiry:
"${cleanQuery}"

Provide a concise, grounded response based strictly on the retrieved records.`;

  // 3. Generate response using Google Gemini if API Key is configured
  let generatedAnswer = null;

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptContent,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2, // Low temperature for high factual grounding
          maxOutputTokens: 600
        }
      });

      if (response && response.text) {
        generatedAnswer = response.text.trim();
      }
    } catch (geminiError) {
      console.warn('[RAG Gemini API Warning]:', geminiError.message);
      // Fallback to grounded algorithmic generation below
    }
  }

  // 4. Grounded Fallback Generator (if Gemini is unavailable or not configured)
  if (!generatedAnswer) {
    if (retrievedMatches.length === 0) {
      generatedAnswer = `I searched the **HavenFind Civic Registry**, but found no active public reports matching "${cleanQuery}".

**Recommended next steps:**
- Verify spelling of the item or try broader terms (e.g. "wallet" instead of "leather bi-fold").
- Check if the incident location was recorded under a neighboring town or civic district.
- If you haven't yet, file an official report using **Submit Item** so you are notified if a matching item is turned in.`;
    } else {
      const itemList = retrievedMatches.map((m, idx) => 
        `**${idx + 1}. ${m.title}** (${m.type.toUpperCase()})\n   - **Location:** ${m.location}\n   - **Reported:** ${m.date}\n   - **Match Details:** ${m.reason}\n   - **Item ID:** \`${m.itemId}\``
      ).join('\n\n');

      generatedAnswer = `I found **${retrievedMatches.length} potentially relevant public report(s)** in the HavenFind Civic Registry:

${itemList}

*Please review the matching card(s) below. If one of these matches your property, open the report to inspect further and submit a verified ownership claim.*`;
    }
  }

  return {
    answer: generatedAnswer,
    matches: retrievedMatches.map(m => ({
      itemId: m.itemId,
      title: m.title,
      type: m.type,
      category: m.category,
      location: m.location,
      imageUrl: m.imageUrl,
      date: m.date,
      score: m.score,
      reason: m.reason
    })),
    retrievedCount: retrievedMatches.length,
    query: cleanQuery
  };
}

module.exports = {
  processRagQuery,
  retrieveRelevantItems,
  buildGroundedContext
};

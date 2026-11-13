# HavenFind — System Architecture & Design Document

## 1. High-Level Architecture

HavenFind is an enterprise-grade full-stack civic lost-and-found recovery network uniting multimodal vector search, real-time application synchronization, grounded RAG intelligence, and secure citizen coordination.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client (React 19 + Vite 8)                  │
│  - Modern Civic UI (Tailwind CSS v4 & Plus Jakarta Sans)        │
│  - Zero-Reload Socket.IO Real-Time State Mesh                   │
│  - Case Dossier & 8-Stage Recovery Lifecycle Tracker            │
│  - Direct Case Coordination Channel (Pre & Post Claim)          │
│  - Persistent Notification Bell & Sonner Live Toasts            │
│  - Multimodal Drag-and-Drop Image & Visual Search Dropzone      │
│  - Grounded RAG Recovery Assistant Floating Drawer              │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP REST & Socket.IO WebSockets
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Application Server (Express 5.x)                 │
│  - Security: Rate Limiting, CORS, ReDoS-Safe Regex, Multer Guard│
│  - JWT & Strict Secret Enforcement (.env only, no fallbacks)   │
│  - Object-Level Authorization (Reporter-only, Claimant-only)    │
│  - Modular REST Controllers (/auth, /items, /claims, /chat,     │
│    /notifications, /ai)                                         │
│  - Socket.IO Real-Time Engine (case_<convId> & user_<userId>)   │
│  - Persistent Notification Service                              │
└───────────────┬─────────────────────────────────┬───────────────┘
                │                                 │
                │ Image Buffers                   │ Vectors & Queries
                ▼                                 ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│       Cloudinary CDN          │ │ Local CLIP Vision Pipeline    │
│  - Secure Cloud Storage       │ │  - @xenova/transformers       │
│  - Image Optimization & URLs  │ │  - Xenova/clip-vit-base-p32   │
│  - Automated Rollback Guard   │ │  - 512-D Normalized Vector    │
└───────────────────────────────┘ └───────────────┬───────────────┘
                                                  │ 512-D Embedding
                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Database Layer (MongoDB Atlas)              │
│  - User Collection (bcrypt salt 10, select: false passwordHash) │
│  - Item Collection (512-D vector array, spatial, status)       │
│  - Claim Collection (item ref, claimant ref, compound index)   │
│  - Notification Collection (user ref, type, read status)       │
│  - Conversation & Message Collections                           │
│  - Atlas $vectorSearch (Cosine similarity) + In-Memory Fallback │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Deep Vector Embedding & RAG Search Pipeline

### Image Vector Extraction
- Utilizes the quantized `Xenova/clip-vit-base-patch32` vision transformer locally in Node.js.
- Eliminates external OpenAI/HuggingFace API rate limits, costs, and token latency.
- Extracts dense visual features into a normalized float array with `length === 512`.
- Pre-warming runs at server startup to ensure subsequent image uploads and search queries execute within milliseconds.

### Hybrid Vector Matching
1. **Primary**: Atlas `$vectorSearch` runs cosine similarity indexing over the `vector_index` definition.
2. **Resilience Fallback**: If Atlas vector index is unavailable or running on a local cluster, an in-memory cosine similarity engine calculates dot products across candidate vectors:
   $$\text{Cosine Similarity} = \frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\|_2 \|\mathbf{B}\|_2}$$
3. **Filtering & Ranking**: Raw scores are mapped to integer percentages ($0-100\%$) and sorted descending, filtering out non-matches.

### Grounded RAG Assistant Pipeline
- User natural language query is projected into the CLIP 512-D vector space.
- Hybrid retrieval extracts top candidates from MongoDB Atlas while strictly excluding confidential verification details (`select: '-confidentialVerification'`).
- Candidates and strict anti-hallucination grounding prompts are delivered to Google Gemini 2.5 Flash, generating truthful civic responses accompanied by direct case dossier links (`/item/:id`).

---

## 3. Civic Case Management & 8-Stage Recovery Lifecycle

```
[1. Lost - Waiting for Match]
               │
               ├──────────────────────────────────────────────┐
               ▼                                              ▼
[2. Found - Waiting for Owner]                 [3. Claim Submitted]
               │                                              │
               └──────────────────────┬───────────────────────┘
                                      ▼
                           [4. Claim Under Review]
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                 [Claim Rejected]          [5. Claim Approved]
                         │                         │
                         ▼                         ▼
                  (Revert to 1/2)          [6. Ready for Handover]
                                                   │
                                                   ▼
                                       [7. Successfully Reunited]
                                                   │
                                                   ▼
                                           [8. Case Closed]
```

### Business Rules Enforced:
- **Author Self-Claim Prevention**: A user cannot claim an item they reported.
- **Duplicate Prevention**: A compound unique index prevents multiple active pending claims by the same claimant on the same item.
- **Resolved Freeze**: Items marked as `Resolved` cannot receive new claims.
- **Auto-Resolution**: Approving a claim transitions the item to `Ready for Handover` and rejects remaining pending claims.
- **Handover Confirmation**: Either party confirms physical handover, transitioning the case to `Resolved` / `Successfully Reunited` and triggering case closure.

---

## 4. Zero-Reload Real-Time Synchronization Mesh

HavenFind's reactive architecture updates all active clients automatically using dedicated Socket.IO event channels:

- **Personal Rooms (`user_<userId>`)**:
  - Delivers persistent in-app notifications (`new_notification`).
  - Broadcasts incoming claim alerts (`claim_submitted`).
  - Notifies claimants of review decisions (`claim_approved`, `claim_rejected`).
  - Delivers additional info requests (`claim_info_requested`) and responses (`claim_info_provided`).
- **Conversation Rooms (`case_<conversationId>`)**:
  - Broadcasts chat messages in real-time (`new_message`).
  - Provides typing indicators (`user_typing`).
- **Public Feeds**:
  - Broadcasts new reports (`new_item_reported`) to update directory cards and registry statistics without manual refresh.
  - Broadcasts status updates (`item_status_updated`).

---

## 5. Security & Privacy Architecture

1. **Password Security**: Bcrypt with salt rounds 10. `passwordHash` is excluded by default (`select: false`) and stripped via schema `toJSON` transforms.
2. **Environment-Enforced JWT**: JWT secrets are strictly sourced from environment variables (`.env`) with zero hardcoded fallbacks.
3. **Privacy Masking**: Exact private street addresses and house numbers are strictly filtered before reaching public clients, exposing only general municipal precincts or cities.
4. **ReDoS Defense**: All user search queries are escaped using `escapeRegex` to prevent Regex Denial of Service attacks.
5. **File Upload Security**:
   - Multer memory storage restricted to 10MB maximum file size.
   - Strict MIME-type (`image/jpeg`, `image/png`, `image/webp`) and file extension matching.
   - Cloudinary orphan cleanup rollback if vector processing fails.
6. **Rate Limiting**: Sliding-window rate limiting applied to authentication endpoints (max 30 requests per 15 minutes per IP).
7. **Object-Level Authorization**: Strictly verifies requester IDs against item reporters before allowing claim resolutions, status changes, or private claim views.
8. **WebSocket Security**: Handshake authentication prevents unauthorized clients from spying on private conversation rooms.
9. **Helpline Integration**: Direct civic escalation hotline (`+91 8092982304`) available across all pages.

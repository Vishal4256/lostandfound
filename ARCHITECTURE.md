# FindIt AI — System Architecture & Design Document

## 1. High-Level Architecture

FindIt AI is an enterprise-grade full-stack platform uniting modern web application design, vector similarity search, and automated claim resolution.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client (React 19 + Vite)                     │
│  - Modern Glassmorphic Dark UI (Tailwind CSS)                    │
│  - AuthContext & Axios Interceptors with Bearer Tokens          │
│  - Socket.IO Client for Real-Time Notification & Messaging       │
│  - Drag-and-Drop Image Dropzone & Geolocation Services           │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP REST & WebSockets
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Application Server (Express 5.x)                 │
│  - Security: Rate Limiting, CORS, ReDoS-Safe Regex, Multer Guard│
│  - JWT & RBAC Authorization Middleware (protect, authorize)     │
│  - Modular REST Controllers (/auth, /items, /claims, /chat)     │
│  - Socket.IO Real-Time Chat Engine with Room Authentication     │
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

---

## 3. Data Integrity & Ownership Claim State Machine

The platform enforces strict state transitions for reported items:

```
               ┌───────────────────────┐
               │        Active         │
               └───────────┬───────────┘
                           │
             Submit Claim  │  Reporter Manual Toggle
                           ▼
               ┌───────────────────────┐
               │     Pending Claim     │
               └───────────┬───────────┘
                           │
             Reporter Action
             ┌─────────────┴─────────────┐
             ▼                           ▼
    ┌─────────────────┐         ┌─────────────────┐
    │  Claim Approved │         │  Claim Rejected │
    └────────┬────────┘         └────────┬────────┘
             │                           │ (If no pending claims)
             ▼                           ▼
    ┌─────────────────┐         ┌─────────────────┐
    │    Resolved     │         │     Active      │
    └─────────────────┘         └─────────────────┘
```

### Business Rules Enforced:
- **Author Self-Claim Prevention**: A user cannot claim an item they reported.
- **Duplicate Prevention**: A compound unique index prevents multiple active pending claims by the same claimant on the same item.
- **Resolved Freeze**: Items marked as `Resolved` cannot receive new claims.
- **Auto-Resolution**: Approving a claim automatically transitions the item to `Resolved` and rejects remaining pending claims.

---

## 4. Security Architecture

1. **Password Security**: Bcrypt with salt rounds 10. `passwordHash` is excluded by default (`select: false`) and stripped via schema `toJSON` transforms.
2. **Token Security**: 7-day signed JWT tokens verified on every protected request.
3. **ReDoS Defense**: All user search queries are escaped using `escapeRegex` to prevent Regex Denial of Service attacks.
4. **File Upload Security**:
   - Multer memory storage restricted to 10MB maximum file size.
   - Strict MIME-type (`image/jpeg`, `image/png`, `image/webp`) and file extension matching.
   - Cloudinary orphan cleanup rollback if vector processing fails.
5. **Rate Limiting**: Custom in-memory rate limiting applied to `/api/auth/login` and `/api/auth/register` (max 30 requests per 15 minutes per IP).
6. **Object-Level Authorization**: Strictly verifies requester IDs against item reporters before allowing claim resolutions, status changes, or private claim views.
7. **WebSocket Security**: Handshake authentication prevents unauthorized clients from spying on private conversation rooms.

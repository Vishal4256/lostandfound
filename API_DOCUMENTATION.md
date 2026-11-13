# HavenFind — Comprehensive API Documentation

Base URL: `/api`

All protected endpoints require an `Authorization: Bearer <token>` header or an authenticated session cookie.

---

## 1. Authentication Endpoints (`/api/auth`)

### `POST /api/auth/register`
Creates a new citizen account with hashed credentials. Rate-limited to 30 requests / 15 mins.

- **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "strongPassword123"
  }
  ```
- **Responses:**
  - `201 Created`:
    ```json
    {
      "success": true,
      "token": "eyJhbGciOi...",
      "user": {
        "_id": "6aa...",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "role": "user",
        "avatar": "https://..."
      }
    }
    ```
  - `400 Bad Request`: Validation failure (missing name, invalid email format, password < 6 chars).
  - `409 Conflict`: Email already registered.

### `POST /api/auth/login`
Authenticates user credentials and returns a signed JWT token.
- **Request Body:**
  ```json
  {
    "email": "jane@example.com",
    "password": "strongPassword123"
  }
  ```
- **Responses:**
  - `200 OK`: Returns JWT token and safe user payload (excluding `passwordHash`).
  - `401 Unauthorized`: Invalid email or password.

### `GET /api/auth/me` [Protected]
Fetches the currently authenticated user's profile.
- **Headers:** `Authorization: Bearer <token>`
- **Responses:**
  - `200 OK`: `{ "success": true, "user": { ... } }`
  - `401 Unauthorized`: Missing, expired, or invalid JWT token.

---

## 2. Items Endpoints (`/api/items`)

### `GET /api/items`
Public feed supporting pagination, keyword search, and hybrid filters.
- **Query Parameters:**
  - `itemType` / `type`: `'lost'` | `'found'` | `'all'`
  - `category`: Category name (e.g., `'Electronics'`, `'Wallets'`, `'Bags'`)
  - `status`: `'Active'` | `'Pending Claim'` | `'Resolved'` | `'all'`
  - `search`: Case-insensitive keyword search (ReDoS-safe regex across title, description, and location)
  - `page`: Page index (default: `1`)
  - `limit`: Number of items per page (default: `20`, max: `100`)
  - `mine`: If `'true'` and authenticated, filters to user's reports.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "count": 20,
      "total": 54,
      "page": 1,
      "totalPages": 3,
      "data": [ ... ]
    }
    ```

### `GET /api/items/stats`
Fetches high-level registry statistics.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "stats": {
        "total": 128,
        "active": 94,
        "inCustody": 21,
        "resolved": 13
      }
    }
    ```

### `POST /api/items` [Protected]
Reports a lost or found item. Uploads image to Cloudinary and generates a 512-D local CLIP vector embedding.
- **Headers:**
  - `Authorization: Bearer <token>`
  - `Content-Type: multipart/form-data`
- **Form Data:**
  - `title`: String (1-100 chars, required)
  - `category`: String (required, validated against enum)
  - `type` / `itemType`: `'lost'` | `'found'` (required)
  - `location`: String (optional)
  - `coordinates`: JSON array `[lng, lat]` (optional)
  - `date`: ISO Date string (optional)
  - `description`: String (optional, max 1000 chars)
  - `image`: Binary file (JPEG, PNG, WebP up to 10MB, required)
- **Responses:**
  - `201 Created`: Created item document with `imageUrl` and sanitized embedding.
  - `400 Bad Request`: Validation failure or missing image.

### `POST /api/items/search`
Submits a query photo to find visually similar items using Atlas Vector Search or in-memory cosine similarity.
- **Content-Type:** `multipart/form-data`
- **Form Data:** `image`: Binary file (required)
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "count": 5,
      "data": [
        {
          "_id": "...",
          "title": "Blue Hiking Backpack",
          "imageUrl": "https://...",
          "category": "Bags",
          "type": "lost",
          "matchPercentage": 96
        }
      ]
    }
    ```

### `GET /api/items/my-items` [Protected]
Returns all items reported by the authenticated user.

### `GET /api/items/:id`
Fetches a single item dossier by MongoDB ObjectId. Masks sensitive private address data for general public safety.

### `PATCH /api/items/:id/status` [Protected]
Updates an item's status. Only the item reporter or an admin may execute this. Emits `item_status_updated`.

### `DELETE /api/items/:id` [Protected]
Deletes an item and cleans up associated claims and chat conversations. (Reporter or Admin only).

---

## 3. Ownership Claims Endpoints (`/api/claims`)

### `POST /api/claims/:itemId` [Protected]
Submits an ownership claim with identifying proof. Automatically sets item status to `'Pending Claim'`. Emits `claim_submitted` and pushes a persistent notification to the reporter.
- **Headers:** `Authorization: Bearer <token>`
- **Form Data / Body:**
  - `proofDetails`: String (required, secret markings, serial number, etc.)
  - `proofImage`: Binary file (optional supporting document/photo)
- **Responses:**
  - `201 Created`: Created claim populated with claimant and item details.
  - `400 Bad Request`: Reporter attempted self-claim or item is already resolved.
  - `409 Conflict`: User already has an active pending claim for this item.

### `GET /api/claims/item/:itemId` [Protected]
Returns all submitted claims for an item. Accessible **only by the item reporter** or an administrator.

### `GET /api/claims/my-claims` [Protected]
Returns all claims submitted by the authenticated user with current review status (`'pending'`, `'approved'`, `'rejected'`).

### `PATCH /api/claims/:id/status` [Protected]
Approves or rejects an ownership claim. Accessible **only by the item reporter** or an administrator.
- If `'approved'`, sets claim to `'approved'`, updates item to `'Ready for Handover'`, and emits `claim_approved`.
- If `'rejected'`, sets claim to `'rejected'`, reverts item to `'Active'` if no other pending claims exist, and emits `claim_rejected`.

### `POST /api/claims/:id/request-info` [Protected]
Reporter requests clarifying verification details or proof from the claimant.
- **Request Body:** `{ "message": "Please confirm the interior serial number." }`
- **Socket Event:** Emits `claim_info_requested` to claimant's room.

### `POST /api/claims/:id/provide-info` [Protected]
Claimant submits the requested additional verification details.
- **Request Body:** `{ "info": "The serial number is SN-9482-B." }`
- **Socket Event:** Emits `claim_info_provided` to reporter's room.

### `POST /api/claims/:id/handover` [Protected]
Confirms safe item handover completion. Updates item status to `'Resolved'`. Emits `item_handed_over` and `case_closed`.

---

## 4. Real-Time Chat & Coordination (`/api/chat`)

### `GET /api/chat/conversations` [Protected]
Returns all active conversations involving the authenticated user.

### `POST /api/chat/conversations` [Protected]
Retrieves or creates a case-based conversation. Supports both **pre-claim citizen inquiries** and **post-claim handover coordination**.
- **Request Body:** `{ "itemId": "...", "recipientId": "..." }`
- **Validation:** Prevents self-chat creation and duplicate room creation.

### `GET /api/chat/conversations/:id/messages` [Protected]
Fetches conversation history. Only authorized participants may read messages.

### `POST /api/chat/conversations/:id/messages` [Protected]
Sends a message into the conversation and emits `new_message` to the conversation's Socket.IO room.
- **Request Body:** `{ "text": "..." }` (max 2000 chars)

---

## 5. Persistent Notifications Endpoints (`/api/notifications`)

### `GET /api/notifications` [Protected]
Returns the authenticated user's notifications sorted newest first, along with an unread counter.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "notifications": [ ... ],
      "unreadCount": 3
    }
    ```

### `PATCH /api/notifications/:id/read` [Protected]
Marks a single notification as read.
- **Responses:** `200 OK`: `{ "success": true, "notification": { ... } }`

### `PATCH /api/notifications/read-all` [Protected]
Marks all user notifications as read.
- **Responses:** `200 OK`: `{ "success": true, "message": "All notifications marked as read." }`

---

## 6. Grounded AI Recovery Assistant (`/api/ai`)

### `POST /api/ai/recovery` [Protected]
Executes a natural language RAG inquiry against the verified HavenFind civic registry. Uses hybrid 512-D CLIP vector matching, lexical search, and Google Gemini 2.5 Flash generation. Rate-limited to 20 queries per 5 minutes.

- **Request Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "query": "I lost my black leather wallet near Phagwara yesterday",
    "conversationHistory": [
      { "role": "user", "text": "Did anyone turn in a wallet?" },
      { "role": "assistant", "text": "I found 2 potentially relevant public reports..." }
    ]
  }
  ```
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "answer": "I found 1 potentially relevant public report in the HavenFind Civic Registry: ...",
      "matches": [
        {
          "itemId": "6abc1282384e59de6594db9a",
          "title": "Black Leather Wallet",
          "type": "found",
          "category": "Wallets",
          "location": "Phagwara, Punjab",
          "imageUrl": "https://...",
          "date": "2026-09-30",
          "score": 0.891,
          "reason": "Matching terms in title/description • High visual vector similarity (92%)"
        }
      ],
      "retrievedCount": 1,
      "query": "I lost my black leather wallet near Phagwara yesterday"
    }
    ```

---

## 7. Socket.IO Real-Time Mesh Specification

- **Handshake Authentication:** `auth: { token: "<JWT>" }`
- **Rooms:**
  - `user_<userId>`: Private notifications and real-time state synchronization.
  - `case_<conversationId>`: Encrypted conversation messaging room.

### Real-Time Event Catalogue:
| Event Name | Direction | Trigger Condition |
| :--- | :--- | :--- |
| `join_user_room` | Client ➔ Server | Joins user's private notification & sync room |
| `join_conversation` | Client ➔ Server | Joins case conversation room |
| `leave_conversation`| Client ➔ Server | Leaves case conversation room |
| `new_message` | Server ➔ Client | Participant sent a chat message |
| `claim_submitted` | Server ➔ Client | New ownership claim filed for item |
| `claim_reviewed` | Server ➔ Client | Claim updated or decision made |
| `claim_approved` | Server ➔ Client | Claim approved; handover unlocked |
| `claim_rejected` | Server ➔ Client | Claim rejected with reason |
| `claim_info_requested` | Server ➔ Client | Reporter requested additional info |
| `claim_info_provided` | Server ➔ Client | Claimant submitted requested info |
| `item_handed_over` | Server ➔ Client | Safe physical return completed |
| `case_closed` | Server ➔ Client | Complete case closed and archived |
| `item_status_updated` | Server ➔ Client | Global listing status changed |
| `new_item_reported` | Server ➔ Client | New lost/found listing registered |
| `new_notification` | Server ➔ Client | New persistent notification pushed |

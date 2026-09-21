# FindIt AI — Comprehensive API Documentation

Base URL: `/api`

All protected endpoints require an `Authorization: Bearer <token>` header or an authenticated session cookie.

---

## 1. Authentication Endpoints (`/api/auth`)

### `POST /api/auth/register`
Creates a new user account with hashed credentials. Rate-limited to 30 requests / 15 mins.

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
Authenticates user credentials and returns a JWT token.

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
  - `401 Unauthorized`: Missing, expired, or malformed JWT token.

---

## 2. Items Endpoints (`/api/items`)

### `GET /api/items`
Public feed supporting pagination, keyword search, and hybrid filters.

- **Query Parameters:**
  - `itemType` / `type`: `'lost'` | `'found'` | `'all'`
  - `category`: Category name (e.g., `'Electronics'`, `'Keys'`, `'Accessories'`)
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
- **Query Parameters (Optional):** `type`, `category`, `includeResolved` (`'true'` | `'false'`)
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
          "category": "Accessories",
          "type": "lost",
          "matchPercentage": 96
        }
      ]
    }
    ```

### `GET /api/items/my-items` [Protected]
Returns all items reported by the authenticated user.

- **Responses:** `200 OK`: `{ "success": true, "count": 3, "data": [ ... ] }`

### `GET /api/items/:id`
Fetches a single item by its MongoDB ObjectId.

- **Responses:**
  - `200 OK`: Item details with populated reporter profile.
  - `400 Bad Request`: Invalid ObjectId.
  - `404 Not Found`: Item does not exist.

### `PATCH /api/items/:id/status` [Protected]
Manually toggles or updates an item's status. Only the item reporter or an admin may execute this.

- **Request Body:** `{ "status": "Active" | "Resolved" }`
- **Responses:**
  - `200 OK`: Updated item document.
  - `403 Forbidden`: User is not the item reporter.

### `DELETE /api/items/:id` [Protected]
Deletes an item and cleans up associated claims and chat conversations. (Reporter or Admin only).

---

## 3. Ownership Claims Endpoints (`/api/claims`)

### `POST /api/claims/:itemId` [Protected]
Submits an ownership claim with secret identifying proof. Automatically sets item status to `'Pending Claim'`.

- **Headers:** `Authorization: Bearer <token>`
- **Form Data / Body:**
  - `proofDetails`: String (required, secret markings, serial number, etc.)
  - `proofImage`: Binary file (optional supporting document/photo)
- **Responses:**
  - `201 Created`: Created claim populated with claimant and item details.
  - `400 Bad Request`: Reporter attempted self-claim, item is already resolved, or proofDetails is empty.
  - `409 Conflict`: User already has an active pending claim for this item.

### `GET /api/claims/item/:itemId` [Protected]
Returns all submitted claims for an item. Accessible **only by the item reporter** or an administrator.

- **Responses:**
  - `200 OK`: Array of claims with claimant profile and proof details.
  - `403 Forbidden`: User is not the item reporter.

### `GET /api/claims/my-claims` [Protected]
Returns all claims submitted by the authenticated user with current review status (`'pending'`, `'approved'`, `'rejected'`).

- **Responses:** `200 OK`: `{ "success": true, "count": 2, "claims": [ ... ] }`

### `PATCH /api/claims/:claimId/resolve` [Protected]
Approves or rejects an ownership claim. Accessible **only by the item reporter** or an administrator.
- If `'approved'`, sets claim to `'approved'`, automatically transitions parent item to `'Resolved'`, and rejects any other pending claims.
- If `'rejected'`, sets claim to `'rejected'` and restores item to `'Active'` if no other pending claims exist.

- **Request Body:** `{ "status": "approved" | "rejected" }`
- **Responses:**
  - `200 OK`: `{ "success": true, "claim": { ... }, "itemStatus": "Resolved" }`
  - `403 Forbidden`: User is not authorized to resolve claims for this item.

---

## 4. Real-Time Chat Endpoints (`/api/chat`)

### `GET /api/chat/conversations` [Protected]
Returns all active conversations involving the authenticated user.

### `POST /api/chat/conversations` [Protected]
Retrieves or initializes a chat between the claimant/finder and the item reporter.
- **Request Body:** `{ "itemId": "...", "recipientId": "..." }`
- **Validation:** Prevents self-chat creation.

### `GET /api/chat/conversations/:id/messages` [Protected]
Fetches conversation history. Only authorized participants may read messages.

### `POST /api/chat/conversations/:id/messages` [Protected]
Sends a message into the conversation and emits a real-time event to the conversation's Socket.IO room.
- **Request Body:** `{ "text": "..." }` (max 2000 chars)

---

## 5. Socket.IO Events

- **Handshake Authentication:** `auth: { token: "<JWT>" }`
- **Client to Server:**
  - `join_user_room(userId)`: Joins personal notification room (strictly validated against authenticated user ID).
  - `join_conversation(conversationId)`: Joins conversation chat room (strictly validated against conversation participant list).
  - `leave_conversation(conversationId)`: Leaves conversation room.
  - `typing({ conversationId, userName, isTyping })`: Broadcasts typing state to conversation participants.
- **Server to Client:**
  - `new_message`: Delivered in real-time when a participant sends a message.
  - `user_typing`: Delivered when another participant is typing.

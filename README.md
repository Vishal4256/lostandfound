<div align="center">

# 🧭 FindIt — AI-Powered Lost & Found Platform

<p align="center">
  <b>Reuniting lost items with their owners using Multimodal AI Visual Search, Ownership Verification, and Real-Time Chat.</b>
</p>

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.2-646C9F?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB%20Atlas-Vector%20Search-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/products/platform/atlas-vector-search)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4.3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-ISC-blue.badge?style=for-the-badge)](LICENSE)

<br />

[Explore Features](#-key-features) • [Architecture](#-architecture) • [Getting Started](#-getting-started) • [Atlas Vector Search](#-mongodb-atlas-vector-search-setup) • [API Reference](#-api-endpoints) • [Testing](#-testing--qa)

</div>

---

## 📖 Overview

**FindIt** is a production-grade, full-stack platform designed to modernize how lost property is reported, visually matched, claimed, and recovered. Unlike legacy lost-and-found boards that rely purely on text keywords, **FindIt** leverages **local Vision-Language AI embeddings (`CLIP ViT-B/32`)** to find visual matches even when titles or descriptions vary completely.

Key highlights:
- **Multimodal Search**: Supports keyword queries, structured filters (category, status, type), and direct image upload matching.
- **Strict Verification & Claims**: Built-in claim workflow with proof submission, author-only approvals, duplicate prevention, and automatic item resolution.
- **Secure Real-Time Communication**: Authenticated Socket.IO conversations ensuring only verified participants can access item communication rooms.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| 🔍 **Multimodal Visual Search** | Upload an image to find similar lost or found items using **512-dimensional CLIP embeddings** and cosine vector similarity. |
| 🛡️ **Ownership Claim System** | Submit ownership claims with proof details/images. Item reporters can review, approve, or reject claims with automatic status updates (`Resolved`). |
| ⚡ **Real-Time In-App Chat** | Integrated Socket.IO messaging with JWT handshake verification, active conversation listings, and dedicated rooms. |
| 🔐 **Hardened Authentication & RBAC** | JWT-based authentication with bcryptjs hashing, sliding-window brute force rate limiting, and server-enforced role access. |
| ☁️ **Cloudinary Media Pipeline** | Robust 10MB memory-buffered image upload pipeline with MIME filtering and automatic orphan-cleanup on failure. |
| 🏷️ **Lifecycle Status Tracking** | Dynamic listing lifecycle (`Active` ➔ `Pending Claim` ➔ `Resolved`) ensuring transparency and preventing stale entries. |
| 🎨 **State-of-the-Art Dark UI** | Glassmorphic dark aesthetic built with **Tailwind CSS v4**, **Framer Motion**, and **Sonner notifications**. |
| 📱 **Responsive & Accessible** | Mobile-first layout, semantic HTML, Radix UI modals, and intuitive UX states. |

---

## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend (React 19 + Vite)"]
        UI[Modern Dark UI]
        VS[Visual Search Modal]
        ClaimsUI[Claim Review Modal]
        ChatUI[Real-time Chat Window]
    end

    subgraph Backend ["Backend (Express 5 + Node.js)"]
        API[Express REST API]
        Auth[JWT & Rate Limiting]
        WS[Socket.IO Server with JWT Handshake]
        CLIP["@xenova/transformers (CLIP ViT-B/32)"]
    end

    subgraph Cloud ["Database & Storage"]
        Mongo[("MongoDB Atlas Database")]
        VectorIdx["Atlas $vectorSearch Index (512-D Cosine)"]
        CDN[Cloudinary Media CDN]
    end

    %% Upload & Embedding Flow
    UI -->|Image Upload & Details| API
    API -->|Generate 512-D Vector| CLIP
    API -->|Save Asset| CDN
    API -->|Store Item & Vector| Mongo

    %% Visual Search Flow
    VS -->|Query Image| API
    API -->|Vectorize Image| CLIP
    CLIP -->|Query Vector| VectorIdx
    VectorIdx -->|Ranked Matches| API
    API -->|Ranked Results & Score| VS

    %% Claims Lifecycle
    ClaimsUI -->|Submit / Approve / Reject Claim| API
    API -->|Update Claim & Transition Item| Mongo

    %% Real-time Chat
    ChatUI <-->|WebSocket Events| WS
    WS <--> Mongo
```

For complete technical specifications, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4, Lucide React icons
- **Animations & Effects**: Framer Motion, `react-parallax-tilt`
- **UI Primitives**: Radix UI Dialog, Radix UI Select
- **Networking**: Centralized Axios API client (`src/services/api.js`), Socket.IO Client
- **Feedback**: Sonner (Toast notifications)

### Backend
- **Runtime**: Node.js & Express 5
- **AI / Embeddings**: `@xenova/transformers` (`Xenova/clip-vit-base-patch32`) generating 512-dimension vectors
- **Database & ODM**: MongoDB Atlas & Mongoose
- **Real-time Protocol**: Socket.IO with token-authenticated handshake
- **Storage**: Cloudinary SDK & Multer (In-memory streaming)
- **Security**: JWT (`jsonwebtoken`), `bcryptjs`, ReDoS-safe search, sliding-window rate limiting

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or later)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster connection string
- [Cloudinary](https://cloudinary.com/) account for image storage

---

### 1. Clone the Repository

```bash
git clone https://github.com/Vishal4256/lostandfound.git
cd lostandfound
```

---

### 2. Backend Configuration & Setup

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Fill in your credentials:
   ```env
   PORT=5000
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/lost-and-found?retryWrites=true&w=majority
   JWT_SECRET=your_super_secret_jwt_key
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

4. Start the backend server:
   ```bash
   npm start
   ```
   > 💡 *Note: On first boot, the local CLIP ViT-B/32 ONNX model is automatically downloaded and cached.*

---

### 3. Frontend Configuration & Setup

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure frontend environment variables:
   Create `frontend/.env` (or review `frontend/.env.example`):
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```text
   http://localhost:5173
   ```

---

## 🗄️ MongoDB Atlas Vector Search Setup

To enable Atlas Vector Search for sub-second cosine visual matching:

1. In the **MongoDB Atlas Console**, navigate to your cluster and click **Search and Vector Search**.
2. Click **Create Search Index** ➔ Select **JSON Editor**.
3. Select your database (e.g., `lost-and-found`) and collection (`items`).
4. Set the **Index Name** to: `vector_index`.
5. Paste the following configuration:

```json
{
  "fields": [
    {
      "numDimensions": 512,
      "path": "embedding",
      "similarity": "cosine",
      "type": "vector"
    },
    {
      "path": "itemType",
      "type": "filter"
    },
    {
      "path": "status",
      "type": "filter"
    },
    {
      "path": "category",
      "type": "filter"
    }
  ]
}
```

6. Click **Create Search Index**.
*(Note: If the Atlas Vector Index is not yet provisioned, the backend automatically falls back to an exact in-memory cosine similarity engine seamlessly!)*

---

## 📡 API Endpoints

For comprehensive request/response payloads and error codes, refer to [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

### 🔑 Authentication
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/auth/register` | Register a new user | ❌ |
| `POST` | `/api/auth/login` | Log in and receive JWT token | ❌ |
| `GET` | `/api/auth/me` | Retrieve current authenticated user profile | ✅ |

### 📦 Items & Visual Search
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/items` | Fetch paginated items (supports `?category=`, `?itemType=`, `?status=`, `?search=`, `?mine=true`) | ❌ / Optional |
| `GET` | `/api/items/:id` | Get detailed item information by ID | ❌ |
| `POST` | `/api/items` | Create a new Lost/Found report with image & AI embedding | ✅ |
| `POST` | `/api/items/search` | Search items visually by uploading an image | ❌ |
| `PATCH` | `/api/items/:id/status` | Update item status (`Active`, `Pending Claim`, `Resolved`) | ✅ |
| `DELETE`| `/api/items/:id` | Delete item (Reporter or Admin only) | ✅ |

### 🛡️ Claims Management
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/claims` | Submit an ownership claim for an item | ✅ |
| `GET` | `/api/claims/my-claims` | Get all claims submitted by current user | ✅ |
| `GET` | `/api/claims/item/:itemId` | Get claims for an item (Reporter or Admin only) | ✅ |
| `PATCH` | `/api/claims/:id/status` | Approve or reject a claim (Reporter only) | ✅ |

### 💬 Real-Time Chat & Conversations
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/chat/conversations` | List user's active conversations | ✅ |
| `POST` | `/api/chat/conversations` | Get or create conversation for an item | ✅ |
| `GET` | `/api/chat/conversations/:id/messages` | Fetch message history for a conversation | ✅ |
| `POST` | `/api/chat/conversations/:id/messages` | Post a new message to conversation | ✅ |

---

## 🧪 Testing & QA

Run the automated test suite covering Authentication, Item Flow, AI Vector Pipeline, Claim Security, and Chat Permissions:

```bash
# In backend/
node test_full_audit_suite.js
```

Detailed test procedures and verification matrices are available in [TESTING.md](TESTING.md).

---

## 📁 Project Structure

```text
lostandfound/
├── backend/
│   ├── config/                 # Cloudinary & DB configurations
│   ├── controllers/            # Route controllers (auth, items, claims, chat)
│   ├── middleware/             # JWT auth, RBAC, Multer upload, rate limiter
│   ├── models/                 # Mongoose schemas (User, Item, Claim, Conversation, Message)
│   ├── routes/                 # Express route definitions
│   ├── services/               # CLIP AI embedding generation service
│   ├── test_full_audit_suite.js# Full automated end-to-end audit test suite
│   ├── .env.example            # Environment variables template
│   ├── package.json            # Node.js dependencies & scripts
│   └── server.js               # Express app & Socket.io server bootstrap
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components, modals, feeds
│   │   │   ├── layout/         # Navbar, layout wrapper
│   │   │   ├── CreateListingModal.jsx
│   │   │   ├── MatchResultsGrid.jsx
│   │   │   └── VisualSearchModal.jsx
│   │   ├── context/            # React AuthContext & SocketContext
│   │   ├── pages/              # Route pages (Home, SubmitItem, ItemDetail, Dashboard, Login, Register)
│   │   ├── services/           # Centralized Axios API client (api.js)
│   │   ├── App.jsx             # Routes & Providers
│   │   └── index.css           # Global theme variables & Tailwind styles
│   ├── index.html              # HTML entry template
│   ├── package.json            # Frontend dependencies & scripts
│   └── vite.config.js          # Vite build configuration
│
├── API_DOCUMENTATION.md        # Comprehensive REST & WebSocket API specification
├── ARCHITECTURE.md             # System architecture, CLIP pipeline & security design
├── TESTING.md                  # Test suites, scenarios & execution instructions
└── README.md                   # Project documentation
```

---

## 📄 License

This project is licensed under the ISC License.

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/Vishal4256">Vishal</a></sub>
</div>

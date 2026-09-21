# FindIt AI — Testing & Quality Assurance Guide

This document outlines the automated and end-to-end testing procedures for the FindIt AI platform.

---

## 1. Automated Test Suites

### Full-Stack Audit & Security Suite (`backend/test_full_audit_suite.js`)
Executes comprehensive end-to-end tests against real MongoDB Atlas and local CLIP instances:

```bash
cd backend
node test_full_audit_suite.js
```

#### Coverage Matrix:
- **Authentication**:
  - Missing field validation (HTTP 400)
  - Weak password rejection (HTTP 400)
  - Password hashing verification (no passwordHash leaks in responses)
  - Duplicate email rejection (HTTP 409)
  - Invalid password login rejection (HTTP 401)
  - Valid login & JWT verification via `/api/auth/me`
  - Forged token rejection (HTTP 401)
- **Item Reporting & AI Embedding**:
  - Missing image rejection (HTTP 400)
  - Invalid category validation (HTTP 400)
  - Image upload to Cloudinary & local CLIP model feature extraction
  - Validation of 512-dimension vector embedding stored in MongoDB
- **Hybrid Search & Security**:
  - ReDoS special character injection protection (safe regex handling)
  - Case-insensitive keyword filtering on title and description
  - Structured filters (`type`, `category`, `status`)
  - Pagination verification (`page`, `totalPages`)
  - Malformed ObjectId rejection (HTTP 400)
- **AI Visual Vector Search**:
  - End-to-end query image upload & vector similarity ranking
  - Match percentage calculation
- **Ownership Claims & Access Control**:
  - Reporter self-claim prevention (HTTP 400)
  - Empty proof details rejection (HTTP 400)
  - Successful claim submission & auto item transition to `Pending Claim`
  - Duplicate pending claim prevention (HTTP 409)
  - Unauthorized user claim view rejection (HTTP 403)
  - Unauthorized claim approval rejection (HTTP 403)
  - Reporter claim approval & automatic parent item transition to `Resolved`
  - Rejection of new claims on already resolved items (HTTP 400)
- **Real-Time Chat & Participant Authorization**:
  - Self-chat creation prevention (HTTP 400)
  - Conversation creation & message sending
  - Unauthorized third-party message reading rejection (HTTP 403)
  - Authorized participant message retrieval

---

## 2. Model & Embedding Verification Scripts

### Embedding Consistency Verification (`backend/test_consistency.js`)
Validates that freshly computed image embeddings match stored vectors with 100.00% cosine similarity:
```bash
cd backend
node test_consistency.js
```

### Database Embedding Health Check (`backend/check_db.js`)
Inspects all items in MongoDB Atlas and reports embedding presence:
```bash
cd backend
node check_db.js
```

---

## 3. Frontend Verification & Build

### Type & Linter Verification
```bash
cd frontend
npm run lint
```

### Production Build
```bash
cd frontend
npm run build
```
- Validates 0 JSX/syntax errors, clean bundle generation, and React 19 compatibility.

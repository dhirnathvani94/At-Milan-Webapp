# 💍 Matrimonial App — Backend API

A complete, production-ready **Node.js + Express + TypeScript** backend for the Matrimonial App matrimonial web application. Built with security-first principles: JWT authentication, bcrypt password hashing, rate limiting, XSS sanitisation, HMAC payment verification, and GDPR compliance.

---

## Table of Contents

1. [What is Matrimonial App?](#what-is-matrimonial-app)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Local Setup — Step by Step](#local-setup--step-by-step)
5. [Environment Variables](#environment-variables)
6. [API Overview](#api-overview)
7. [Real-time Features (Socket.IO)](#real-time-features-socketio)
8. [Security Features](#security-features)
9. [Deploy to Render](#deploy-to-render)
10. [Scripts Reference](#scripts-reference)

---

## What is Matrimonial App?

Matrimonial App is a full-featured matrimonial platform where users can:

- Create detailed profiles (personal, education, family, lifestyle, horoscope)
- Search and filter matches by religion, caste, age, location, education, and more
- Send and receive interests, exchange messages in real-time
- Shortlist profiles, view who visited their profile
- Purchase membership plans and credit packages via Razorpay
- Use credits to reveal contact details of matches
- Upload photos and verification documents
- Receive real-time notifications via Socket.IO and push notifications via Firebase FCM
- Submit GDPR data export and account deletion requests

The **React frontend** is fully pre-built. This repository contains only the backend API.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| Language | TypeScript 5 (strict mode) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Real-time | Socket.IO 4 |
| Database | JSON file (database.json) — zero setup |
| File uploads | Multer |
| Email | Nodemailer (SMTP) |
| Payments | Razorpay (HMAC signature verification) |
| Validation | Zod |
| Security | Helmet, CORS, express-rate-limit, xss-clean, hpp, express-mongo-sanitize |
| Dev server | tsx watch |

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── env.ts              # Env validation — server stops if secrets missing
│   │   └── cors.ts             # CORS allowed origins
│   ├── middleware/
│   │   ├── auth.ts             # JWT authentication + requireAdmin
│   │   ├── logger.ts           # Request logger (console dev / file prod)
│   │   ├── rateLimit.ts        # 5 rate limiters (auth, otp, api, upload, admin)
│   │   ├── security.ts         # Helmet + CORS + XSS + HPP stack
│   │   └── validate.ts         # Zod schema validation middleware
│   ├── controllers/
│   │   ├── auth.controller.ts          # register, login, adminLogin, OTP, social, reset
│   │   ├── profile.controller.ts       # profile CRUD, photos, views
│   │   ├── search.controller.ts        # search, recommendations, new members
│   │   ├── interest.controller.ts      # send/respond/list interests
│   │   ├── message.controller.ts       # send/read messages
│   │   ├── notification.controller.ts  # notifications CRUD
│   │   ├── shortlist.controller.ts     # toggle/list shortlists
│   │   ├── credits.controller.ts       # balance, reveal contact
│   │   ├── dashboard.controller.ts     # stats for logged-in user
│   │   ├── payment.controller.ts       # Razorpay order + HMAC verify
│   │   ├── plans.controller.ts         # membership + credit plans
│   │   ├── purchase.controller.ts      # activate membership/credits
│   │   ├── verification.controller.ts  # document approval workflow
│   │   ├── safety.controller.ts        # block, report, unblock
│   │   ├── document.controller.ts      # document upload/replace
│   │   └── public.controller.ts        # success stories, contact, FCM, coupons
│   ├── routes/                 # One file per feature area
│   ├── services/
│   │   ├── token.service.ts    # JWT sign/verify
│   │   ├── otp.service.ts      # In-memory OTP store with auto-cleanup
│   │   ├── email.service.ts    # Nodemailer + HTML email templates
│   │   ├── audit.service.ts    # Audit log CRUD
│   │   └── socket.service.ts   # Socket.IO init, online users, emit helpers
│   ├── db/
│   │   └── database.ts         # JSON file read/write with safe rename
│   └── server.ts               # Express app + HTTP server entry point
├── uploads/
│   ├── photos/                 # User profile photos
│   └── documents/              # Verification documents
├── logs/                       # app.log (production only)
├── scripts/
│   ├── setup.ts                # One-time setup: generates .env with secure secrets
│   └── test-security.ts        # 7 automated security tests
├── .env.example                # Template — copy to .env and fill in
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## Local Setup — Step by Step

### Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm 9+** (comes with Node.js)
- Two terminal windows

---

### TERMINAL WINDOW 1 — Backend

```bash
# 1. Navigate to the backend folder
cd backend

# 2. Install dependencies
npm install

# 3. Run the one-time setup script
#    This generates a secure JWT_SECRET and ENCRYPTION_KEY and writes backend/.env
npx tsx scripts/setup.ts
```

The setup script will:
- Ask for your admin email and password
- Generate cryptographically secure `JWT_SECRET` (64 bytes) and `ENCRYPTION_KEY` (32 bytes)
- Write `backend/.env` with all values filled in

After setup, open `backend/.env` and confirm these are set correctly:

```env
ADMIN_EMAIL=your-email@gmail.com
ADMIN_PASSWORD=YourStrongPassword123!
```

> ⚠️ Password must be at least 12 characters.

```bash
# 4. Start the backend development server
npm run dev
```

**Expected output:**

```
╔══════════════════════════════════════════════════╗
║   💍 Matrimonial App Backend running on port 5000    ║
║   Environment : development                      ║
║   Frontend URL: http://localhost:5173            ║
╚══════════════════════════════════════════════════╝

[Bootstrap] Admin account ready: your-email@gmail.com
[Socket] Socket.IO initialised.
```

---

### TERMINAL WINDOW 2 — Frontend

```bash
# Navigate to the project root (where vite.config.ts is)
cd ..

# Install frontend dependencies
npm install

# Start the Vite dev server
npm run dev
```

**Expected output:**

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://0.0.0.0:5173/
```

> The Vite proxy is already configured — all `/api` and `/uploads` requests from the
> frontend are automatically forwarded to `http://localhost:5000`. No CORS issues.

---

### TERMINAL WINDOW 3 — Security Tests

```bash
cd backend
npx tsx scripts/test-security.ts
```

**Expected output:**

```
╔══════════════════════════════════════════════════════╗
║     💍 Matrimonial App — Backend Security Tests          ║
║     Target: http://localhost:5000                    ║
╚══════════════════════════════════════════════════════╝

  ✅ PASS  Test 1: GET /api/admin/users (no token) → expect 401
  ✅ PASS  Test 2: GET /api/admin/settings (no token) → expect 401
  ✅ PASS  Test 3: GET /api/master-data/admin_settings_kv → expect 403
  ✅ PASS  Test 4: POST /api/auth/login wrong password 6x → expect 429 on 6th
  ✅ PASS  Test 5: GET /api/payment-gateways/active → confirm NO key_secret
  ✅ PASS  Test 6: XSS payload in register body → expect sanitized or rejected
  ✅ PASS  Test 7: GET /api/health → expect { status: 'ok' }

──────────────────────────────────────────────────────────
  Results: 7/7 passed
  ✅ All security tests passed.
```

---

### Browser Verification Checklist

Open your browser and verify each item:

| Check | URL / Action | Expected |
|---|---|---|
| ✅ App loads | `http://localhost:5173` | Full app UI with design |
| ✅ Register | Click Register, fill form | No errors, redirects to dashboard |
| ✅ Login | Enter credentials | Dashboard opens |
| ✅ No password in responses | DevTools → Network tab → any API response | No `password` or `password_hash` field |
| ✅ Admin route blocked | `http://localhost:5000/api/admin/users` | `{"error":"Authentication required..."}` |
| ✅ Admin settings blocked | `http://localhost:5000/api/admin/settings` | `{"error":"Authentication required..."}` |
| ✅ Sensitive table blocked | `http://localhost:5000/api/master-data/admin_settings_kv` | `{"error":"Access to this table is forbidden."}` |
| ✅ Admin login | Login with `ADMIN_EMAIL` + `ADMIN_PASSWORD` | Admin panel opens |
| ✅ SMTP setup | Admin → Settings → Email | Enter SMTP details, save |
| ✅ Payment setup | Admin → Payment Gateways | Enter Razorpay keys, save |
| ✅ Real-time messages | Open two browser tabs, send message | Message appears instantly |
| ✅ Real-time interests | Send interest from one tab | Notification appears in other tab |

---

## Environment Variables

All variables are defined in `backend/.env`. The server **will not start** if any required variable is missing or still contains a placeholder value.

### Required (auto-generated by setup.ts)

| Variable | Description |
|---|---|
| `JWT_SECRET` | 64-byte hex secret for signing JWTs. Generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ENCRYPTION_KEY` | 32-byte hex key for field encryption. Must be exactly 64 hex characters. |

### Required (set manually)

| Variable | Description | Example |
|---|---|---|
| `ADMIN_EMAIL` | Admin login email | `admin@yourdomain.com` |
| `ADMIN_PASSWORD` | Admin login password (min 12 chars) | `MyStr0ng!Pass` |

### Optional (defaults shown)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |
| `JWT_EXPIRY` | `2h` | JWT token lifetime |
| `DB_FILE` | `./database.json` | Path to JSON database file |
| `ELASTICSEARCH_URL` | _(empty)_ | Optional — app works without it |

### Configured via Admin Panel (stored in database)

These are **not** in `.env` — they are saved to the database via Admin → Settings:

| Setting Key | Description |
|---|---|
| `smtp_host` | SMTP server hostname (e.g. `smtp.gmail.com`) |
| `smtp_port` | SMTP port (e.g. `587`) |
| `smtp_user` | SMTP username / email address |
| `smtp_pass` | SMTP password or app password |
| `smtp_from_name` | Sender display name (e.g. `Matrimonial App`) |
| `smtp_from_email` | Sender email address |
| `firebase_api_key` | Firebase public API key |
| `firebase_auth_domain` | Firebase auth domain |
| `firebase_project_id` | Firebase project ID |
| `firebase_storage_bucket` | Firebase storage bucket |
| `firebase_messaging_sender_id` | Firebase messaging sender ID |
| `firebase_app_id` | Firebase app ID |
| `firebase_vapid_key` | Firebase VAPID key for web push |

Payment gateway keys (Razorpay `key_id`, `key_secret`) are stored in the `payment_gateways` table via Admin → Payment Gateways. The `key_secret` is **never** returned to the frontend.

---

## API Overview

All routes are prefixed with `/api`.

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Register new user |
| POST | `/auth/login` | — | Login |
| POST | `/auth/admin/login` | — | Admin login |
| GET | `/auth/verify-email` | — | Verify email token |
| POST | `/auth/forgot-password` | — | Request password reset |
| POST | `/auth/reset-password` | — | Reset password |
| POST | `/auth/send-otp` | — | Send OTP |
| POST | `/auth/verify-otp` | — | Verify OTP |
| POST | `/auth/social-login` | — | Google/Facebook login |

### Profiles
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/profiles/:id` | Optional | View profile |
| PATCH | `/profiles/:id` | ✅ | Update full profile |
| POST | `/profiles/:id/personal` | ✅ | Update personal section |
| POST | `/profiles/:id/education` | ✅ | Update education section |
| POST | `/profiles/:id/family` | ✅ | Update family section |
| POST | `/profiles/:id/lifestyle` | ✅ | Update lifestyle section |
| POST | `/profiles/:id/horoscope` | ✅ | Update horoscope section |
| POST | `/profiles/:id/preferences` | ✅ | Update partner preferences |
| POST | `/profiles/:id/complete` | ✅ | Mark profile complete |

### Search
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/search` | Optional | Search profiles with filters |
| GET | `/search/suggest` | Optional | Autocomplete suggestions |
| GET | `/recommendations` | ✅ | Profiles matching your preferences |
| GET | `/new-members` | Optional | Recently joined profiles |

### Interests, Messages, Notifications
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/interests` | ✅ | Send interest |
| POST | `/interests/:id/status` | ✅ | Accept or decline |
| GET | `/interests/received/:userId` | ✅ | Received interests |
| GET | `/interests/sent/:userId` | ✅ | Sent interests |
| GET | `/messages/:userId/:otherUserId` | ✅ | Get conversation |
| POST | `/messages` | ✅ | Send message |
| GET | `/notifications/:userId` | ✅ | Get notifications |
| POST | `/notifications/:id/read` | ✅ | Mark as read |

### Payments
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/payment-gateways/active` | — | Get active gateway (no secret) |
| POST | `/payment/create-order` | ✅ | Create Razorpay order |
| POST | `/payment/verify` | ✅ | Verify HMAC signature |
| POST | `/checkout` | ✅ | Complete purchase |
| GET | `/plans/membership` | — | List membership plans |
| GET | `/plans/credits` | — | List credit packages |

### Admin
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/admin/users` | ✅ Admin | List all users |
| GET | `/admin/settings` | ✅ Admin | Get all settings |
| POST | `/admin/settings` | ✅ Admin | Save settings |
| GET | `/verification/pending` | ✅ Admin | Pending documents |
| POST | `/verification/approve/:id` | ✅ Admin | Approve document |
| POST | `/verification/reject/:id` | ✅ Admin | Reject document |

### GDPR
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/gdpr/categories` | ✅ | List exportable categories |
| POST | `/gdpr/export` | ✅ | Export all user data as JSON |
| POST | `/gdpr/delete` | ✅ | Anonymise and delete account |
| POST | `/gdpr/consent` | ✅ | Record consent |

---

## Real-time Features (Socket.IO)

The backend uses Socket.IO for real-time events. The frontend connects using the token stored in `localStorage` under the key `atmilan-token`.

### Connection

```javascript
const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('atmilan-token') },
  query: { token: localStorage.getItem('atmilan-token') },
})
```

### Events

| Event (client → server) | Payload | Description |
|---|---|---|
| `conversation:join` | `{ conversationId }` | Join a chat room |
| `conversation:leave` | `{ conversationId }` | Leave a chat room |
| `typing:start` | `{ conversationId }` | Start typing indicator |
| `typing:stop` | `{ conversationId }` | Stop typing indicator |
| `message:send` | `{ conversationId, content, tempId }` | Send a message |

| Event (server → client) | Payload | Description |
|---|---|---|
| `online:users` | `string[]` | List of online user IDs |
| `user:online` | `{ userId }` | A user came online |
| `user:offline` | `{ userId }` | A user went offline |
| `typing:started` | `{ conversationId, userId }` | Someone is typing |
| `typing:stopped` | `{ conversationId, userId }` | Someone stopped typing |
| `message:new` | `{ message, conversation_id }` | New message received |
| `message:received` | `{ conversationId, senderId, content }` | Real-time message delivery |
| `interest:received` | `{ interest, sender }` | New interest received |
| `interest:accepted` | `{ interest, receiver }` | Your interest was accepted |
| `interest:declined` | `{ interest, receiver }` | Your interest was declined |
| `document:approved` | `{ document_id, type }` | Document approved by admin |
| `document:rejected` | `{ document_id, type, reason }` | Document rejected by admin |

---

## Security Features

| Feature | Implementation |
|---|---|
| **Password hashing** | bcrypt with 12 salt rounds — never stored in plain text |
| **JWT authentication** | HS256, signed with 64-byte secret, 2h expiry |
| **Admin credentials** | Read from env only — never hardcoded anywhere |
| **Rate limiting** | Auth: 5/15min · OTP: 3/10min · API: 100/min · Upload: 10/min · Admin: 60/min |
| **Login lockout** | Account locked for 15 minutes after 5 failed attempts |
| **CORS** | Locked to `FRONTEND_URL` only — no wildcard `*` |
| **Helmet** | HSTS, X-Frame-Options DENY, noSniff, XSS filter, strict CSP |
| **XSS sanitisation** | xss-clean strips `<script>` tags from all request bodies |
| **HTTP Parameter Pollution** | hpp middleware prevents duplicate query params |
| **NoSQL injection** | express-mongo-sanitize strips `$` operators |
| **Payment security** | Razorpay HMAC-SHA256 signature verified server-side — `key_secret` never sent to frontend |
| **Master data protection** | `admin_settings_kv`, `users`, `audit_logs`, `otps` blocked from public API |
| **Password in responses** | `password_hash` is explicitly stripped from every API response |
| **GDPR compliance** | Data export, consent recording, right-to-erasure (anonymisation) |
| **Audit logging** | All sensitive actions logged with IP, user agent, timestamp |
| **Stack trace hiding** | Error details never exposed in production responses |
| **Secure file uploads** | MIME type + extension double-check, UUID filenames, 5MB limit |
| **Email enumeration prevention** | Forgot password and resend verification always return generic success |

---

## Deploy to Render

### Step 1 — Push backend to GitHub

```bash
# From the backend folder
git init
git add .
git commit -m "Initial backend"
git remote add origin https://github.com/your-username/matrimonial-app-backend.git
git push -u origin main
```

### Step 2 — Create a Web Service on Render

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:

| Setting | Value |
|---|---|
| **Name** | `matrimonial-app-backend` |
| **Root Directory** | `backend` (if monorepo) or leave blank |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or Starter for production) |

### Step 3 — Set Environment Variables on Render

In Render → Your Service → **Environment**, add:

```
PORT                = 5000
NODE_ENV            = production
FRONTEND_URL        = https://your-app.vercel.app
JWT_SECRET          = (paste from your .env)
JWT_EXPIRY          = 2h
ENCRYPTION_KEY      = (paste from your .env)
ADMIN_EMAIL         = your-admin@email.com
ADMIN_PASSWORD      = YourStrongPassword123!
DB_FILE             = ./database.json
```

> ⚠️ For production, consider replacing the JSON database with PostgreSQL or MongoDB.
> The JSON file works perfectly for development and small deployments.

### Step 4 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your frontend repo
2. Set environment variables:

```
VITE_API_URL    = https://matrimonial-app-backend.onrender.com
VITE_SOCKET_URL = https://matrimonial-app-backend.onrender.com
```

3. Deploy — Vercel auto-detects Vite and builds correctly.

### Step 5 — Update CORS

After deploying, update `FRONTEND_URL` in Render to your Vercel URL:

```
FRONTEND_URL = https://your-app.vercel.app
```

---

## Scripts Reference

| Script | Command | Description |
|---|---|---|
| Development server | `npm run dev` | Start with hot reload via `tsx watch` |
| Production build | `npm run build` | Compile TypeScript to `dist/` |
| Production start | `npm start` | Run compiled `dist/server.js` |
| One-time setup | `npm run setup` | Generate `.env` with secure secrets |
| Security tests | `npx tsx scripts/test-security.ts` | Run 7 automated security checks |

---

## Troubleshooting

**"Missing required environment variable: JWT_SECRET"**
→ Run `npx tsx scripts/setup.ts` to generate your `.env` file.

**"Admin account ready" not showing**
→ Check `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set in `.env` and the server restarted.

**Frontend shows CORS error**
→ Confirm `FRONTEND_URL` in `backend/.env` matches exactly where the frontend is running (including port).

**Socket.IO not connecting**
→ In development, the Vite proxy handles `/socket.io` — make sure both servers are running. In production, ensure `VITE_SOCKET_URL` points to your backend URL.

**Emails not sending**
→ SMTP settings are configured via Admin Panel → Settings, not in `.env`. Log in as admin and fill them in.

**Payment verification failing**
→ Ensure `key_secret` in the payment gateway record matches your Razorpay dashboard exactly. The HMAC is computed server-side using this value.

---

## License

MIT — built for the Matrimonial App matrimonial platform.

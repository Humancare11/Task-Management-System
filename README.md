# Humancare Task Management System

A multi-tenant task and project management system. Each company that signs up gets its own **Organization**, with role-based members who create **Projects** and manage **Tasks** inside them.

---

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Database Setup](#database-setup)
- [Environment Variables](#environment-variables)
- [Authentication](#authentication)
- [External Services](#external-services)
- [Available Commands](#available-commands)
- [Project Structure](#project-structure)
- [API Overview](#api-overview)
- [Troubleshooting](#troubleshooting)
- [Production Build](#production-build)
- [Security Notes](#security-notes)

---

## Features

- Company (organization) registration with the first user becoming `owner`
- Email/password login and **Google OAuth** login
- Role-based access control: `owner`, `admin`, `manager`, `member`, `client`
- Organization member invitations (email + role, token-based, 7-day expiry)
- Projects (create/read/update/delete, status, priority, dates)
- Project membership (per-project roles: `manager`, `member`, `viewer`)
- Tasks (create/read/update/delete, status, priority, assignment, due dates)

## Technology Stack

```text
Frontend:
React 18 + Vite 5 + React Router 6 + Tailwind CSS + Axios

Backend:
Node.js + Express 4

Database:
MySQL (via mysql2 driver)

ORM:
Sequelize 6 (+ sequelize-cli for migrations)

Authentication:
JWT (jsonwebtoken) for API auth, bcryptjs for password hashing,
Passport.js + passport-google-oauth20 for Google OAuth,
express-session (session support required by Passport)

API architecture:
REST, JSON, prefixed under /api

Package manager:
npm (both frontend and backend)
```

There is no Docker setup, no TypeScript, no ORM other than Sequelize, and no separate state-management library on the frontend (auth state uses React Context).

## Architecture

```text
Browser (React SPA, Vite dev server: http://localhost:5173)
   │
   │  axios → http://localhost:5000/api/...
   │  Authorization: Bearer <JWT>  (from localStorage)
   ▼
Express API (Task-Manager-Backend, http://localhost:5000)
   │  routes → middleware (requireAuth / requireRole) → controllers
   ▼
Sequelize ORM
   ▼
MySQL database (task_manager)
```

Google OAuth flow additionally uses server-side sessions (`express-session` + Passport) only during the OAuth handshake; all authenticated API calls afterward use the stateless JWT.

---

## Requirements

Install these on the target machine before doing anything else:

| Tool | Verified version (this machine) | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | v22.16.0 | Any current Node 18+ LTS works; no `engines` field is pinned in `package.json` |
| npm | 11.9.0 | Ships with Node.js |
| [MySQL Server](https://dev.mysql.com/downloads/mysql/) | 8.0.46 | Any MySQL 5.7+/8.x server works with `mysql2` |
| [Git](https://git-scm.com/) | any recent version | To clone the repository |

Verify after installing:

```bash
node -v
npm -v
git --version
mysql --version
```

No Python, Docker, Redis, or other runtime is required.

---

## Quick Start

```bash
git clone <REPLACE_WITH_YOUR_REPOSITORY_URL>
cd "Task Management System"

# 1. Backend
cd Task-Manager-Backend
npm install
copy .env.example .env      # Windows (PowerShell/cmd). Use `cp` on macOS/Linux.
# edit .env: set DB_PASSWORD, JWT_SECRET, etc. — see Environment Variables below

# 2. Create the database, then run migrations
npx sequelize-cli db:create
npx sequelize-cli db:migrate

# 3. Start the backend (http://localhost:5000)
npm run dev
```

In a second terminal:

```bash
cd Task-Manager-Frontend
npm install
npm run dev
```

Open **http://localhost:5173**, register a company, and you're in.

---

## Backend Setup

Location: [Task-Manager-Backend/](Task-Manager-Backend/)

Entry point: [index.js](Task-Manager-Backend/index.js) — sets up Express, CORS, JSON body parsing, `express-session`, Passport, mounts routes, connects to MySQL, then listens.

```bash
cd Task-Manager-Backend
npm install
```

Create `Task-Manager-Backend/.env` from [.env.example](Task-Manager-Backend/.env.example) (see [Environment Variables](#environment-variables)).

Run migrations (see [Database Setup](#database-setup)), then start the server:

```bash
npm run dev     # nodemon index.js — auto-restarts on file changes (development)
# or
npm start       # node index.js — plain start (no auto-restart)
```

On success you'll see in the terminal:

```text
✅ MySQL connected successfully.
🚀 Server running on http://localhost:5000
```

**Verify it's running:**

```bash
curl http://localhost:5000/api/health
# {"status":"ok","message":"Server is running"}
```

The backend listens on **port 5000** by default (`PORT` in `.env`). All routes are prefixed with `/api`.

## Frontend Setup

Location: [Task-Manager-Frontend/](Task-Manager-Frontend/)

Entry point: [src/main.jsx](Task-Manager-Frontend/src/main.jsx) → [src/App.jsx](Task-Manager-Frontend/src/App.jsx) (React Router routes).

```bash
cd Task-Manager-Frontend
npm install
npm run dev
```

Vite dev server runs on **http://localhost:5173** (fixed in [vite.config.js](Task-Manager-Frontend/vite.config.js)).

**Frontend ↔ backend connection:** the API base URL is **hardcoded** in [src/api/client.js](Task-Manager-Frontend/src/api/client.js):

```js
const api = axios.create({ baseURL: "http://localhost:5000/api" });
```

There is no `VITE_API_URL`/`.env` for the frontend — it always points at `http://localhost:5000/api`. This works out of the box as long as the backend also runs on port 5000 on the same machine. If you run the backend on a different host/port, you must edit that `baseURL` manually (or introduce an env variable yourself — not required for a same-machine setup).

The JWT is stored in `localStorage` (`token`, `user`) via [src/context/AuthContext.jsx](Task-Manager-Frontend/src/context/AuthContext.jsx) and attached to every request by an Axios interceptor.

---

## Database Setup

**Type:** MySQL · **Default database name:** `task_manager` · **Default port:** `3306`
**ORM:** Sequelize · **Migration CLI:** `sequelize-cli` (config: [.sequelizerc](Task-Manager-Backend/.sequelizerc), [config/config.js](Task-Manager-Backend/config/config.js))

There are **no seeders** in this project (`seeders/` referenced in `.sequelizerc` but the folder does not exist) — the database starts empty after migrations.

### Steps

1. **Install and start MySQL** (MySQL Server 8.x recommended; Windows: install via MySQL Installer and ensure the "MySQL80" service is running).
2. **Configure `Task-Manager-Backend/.env`** with your MySQL credentials (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
3. **Create the database:**
   ```bash
   cd Task-Manager-Backend
   npx sequelize-cli db:create
   ```
   (Or manually: `CREATE DATABASE task_manager;` in a MySQL client.)
4. **Run all migrations:**
   ```bash
   npx sequelize-cli db:migrate
   ```
5. **Verify:**
   ```bash
   npx sequelize-cli db:migrate:status
   ```
   All 8 migrations should show `up`.

### Tables created (in migration order)

| # | Migration | Table |
|---|---|---|
| 1 | `20260812060559-create-organizations.js` | `organizations` |
| 2 | `20260812062230-create-users.js` | `users` |
| 3 | `20260812063038-create-auth-identities.js` | `auth_identities` |
| 4 | `20260812063102-create-organization-members.js` | `organization_members` |
| 5 | `20260814115900-create-organization-invitations.js` | `organization_invitations` |
| 6 | `20260814132954-create-projects.js` | `projects` |
| 7 | `20260818073952-create-project-members.js` | `project_members` |
| 8 | `20260818093856-create-tasks.js` | `tasks` |

No custom MySQL extensions/plugins are required — plain MySQL with `mysql2`-compatible authentication (`caching_sha2_password` or `mysql_native_password`) is fine.

---

## Environment Variables

Only the **backend** has environment variables. The frontend has none (API URL is hardcoded — see [Frontend Setup](#frontend-setup)).

Template file: [Task-Manager-Backend/.env.example](Task-Manager-Backend/.env.example) — copy it to `.env` and fill in real values. **Never commit `.env`.**

| Variable | Required? | Used For | Example |
|---|---|---|---|
| `PORT` | No (defaults to 5000) | Backend HTTP port | `5000` |
| `DB_HOST` | Yes | MySQL host | `localhost` |
| `DB_PORT` | Yes | MySQL port | `3306` |
| `DB_NAME` | Yes | Database name | `task_manager` |
| `DB_USER` | Yes | MySQL username | `root` |
| `DB_PASSWORD` | Yes | MySQL password | `your_database_password` |
| `JWT_SECRET` | Yes | Signs/verifies API auth tokens | `a long random string` |
| `JWT_EXPIRES_IN` | No (defaults to `7d`) | JWT expiry | `7d` |
| `SESSION_SECRET` | Recommended | Signs the `express-session` cookie used during the Google OAuth handshake | `a long random string` |
| `GOOGLE_CLIENT_ID` | Only for Google login | Passport Google OAuth strategy | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Only for Google login | Passport Google OAuth strategy | from Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | Only for Google login | OAuth redirect URI registered with Google | `http://localhost:5000/api/auth/google/callback` |
| `FRONTEND_URL` | Only for Google login | Where the backend redirects after a successful/failed Google login | `http://localhost:5173` |

Email/password registration and login work without any of the Google variables set — Google sign-in will simply fail if they're missing.

---

## Authentication

Traced from [authController.js](Task-Manager-Backend/controllers/authController.js), [authRoutes.js](Task-Manager-Backend/routes/authRoutes.js), [authMiddleware.js](Task-Manager-Backend/middleware/authMiddleware.js), [passport.js](Task-Manager-Backend/config/passport.js).

**Email/password:**
1. `POST /api/auth/register` — `{ company_name, first_name, last_name?, email, password }`. Creates an `Organization`, a `User`, an `AuthIdentity` (`provider: "local"`, bcrypt password hash), and an `OrganizationMember` row with `role: "owner"`. Returns a JWT.
2. `POST /api/auth/login` — `{ email, password }`. Verifies against the `local` `AuthIdentity`, looks up the active `OrganizationMember`, returns a JWT.
3. `POST /api/auth/register/invitation` — `{ token, first_name, last_name?, password }`. Completes signup from an organization invitation link.

**Google OAuth (optional, requires `GOOGLE_*` env vars):**
- `GET /api/auth/google` → redirects to Google consent screen.
- `GET /api/auth/google/callback` → Passport verifies the profile, finds/creates the `User` + `Organization` + `AuthIdentity` (`provider: "google"`), issues a JWT, and redirects to `{FRONTEND_URL}/oauth-success?token=...`.
- The frontend's [OAuthSuccess.jsx](Task-Manager-Frontend/src/pages/OAuthSuccess.jsx) page reads the token from the query string, calls `GET /api/auth/me` to fetch the user, and logs them in.

**Token transport & storage:**
- JWT payload: `{ id, organization_id, role }`, signed with `JWT_SECRET`.
- Sent as `Authorization: Bearer <token>` (attached automatically by the Axios interceptor in [client.js](Task-Manager-Frontend/src/api/client.js)).
- Stored client-side in `localStorage` (`token`, `user`).
- Verified server-side by `requireAuth` middleware ([authMiddleware.js](Task-Manager-Backend/middleware/authMiddleware.js)); all `/api/organization/*` and `/api/projects/*` routes require it.

**Authorization:** `requireRole(...roles)` ([roleMiddleware.js](Task-Manager-Backend/middleware/roleMiddleware.js)) gates specific project/organization actions by the caller's `organization_id`-scoped role (`owner`, `admin`, `manager`, `member`, `client`).

To make Google login work on a new machine, register OAuth credentials at the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and add `http://localhost:5000/api/auth/google/callback` as an authorized redirect URI, then set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` in `.env`.

---

## External Services

| Service | Required for local dev? | Why | Env vars |
|---|---|---|---|
| MySQL | **Yes** | Primary data store | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` |
| Google OAuth | No (optional) | "Sign in with Google" | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` |

No other external services (no AWS, Cloudinary, Stripe, SendGrid/SMTP, Firebase, Redis, WebSockets/Socket.IO, or payment gateways) are used anywhere in the codebase. Organization invitations generate a token in the database but the project does **not** send invitation emails — the token/link must currently be shared manually.

---

## Available Commands

**Backend** ([Task-Manager-Backend/package.json](Task-Manager-Backend/package.json)):

```bash
npm run dev     # nodemon index.js — start with auto-restart (development)
npm start       # node index.js — plain start (production-style)
```

Sequelize CLI (run from `Task-Manager-Backend/`):

```bash
npx sequelize-cli db:create              # create the database
npx sequelize-cli db:migrate             # apply all pending migrations
npx sequelize-cli db:migrate:status      # show migration status
npx sequelize-cli db:migrate:undo        # revert the last migration
```

**Frontend** ([Task-Manager-Frontend/package.json](Task-Manager-Frontend/package.json)):

```bash
npm run dev       # vite — start dev server on http://localhost:5173
npm run build     # vite build — production build into dist/
npm run preview   # vite preview — serve the production build locally
```

There are no `test` or `lint` scripts defined in either `package.json`.

---

## Project Structure

```text
Task Management System/
├── Task-Manager-Backend/
│   ├── config/
│   │   ├── config.js        # Sequelize CLI DB config (reads .env)
│   │   ├── db.js             # Sequelize instance + connectDB()
│   │   └── passport.js       # Google OAuth strategy
│   ├── controllers/          # authController, organizationController, projectController, projectMemberController
│   ├── middleware/           # authMiddleware (JWT), roleMiddleware (RBAC)
│   ├── migrations/           # Sequelize migrations (8 tables)
│   ├── models/                # Sequelize models + associations (models/index.js)
│   ├── routes/                # authRoutes, organizationRoutes, projectRoutes
│   ├── .env.example
│   ├── .sequelizerc
│   ├── index.js               # Express app entry point
│   └── package.json
│
├── Task-Manager-Frontend/
│   ├── src/
│   │   ├── api/client.js      # Axios instance (hardcoded baseURL) + JWT interceptor
│   │   ├── components/        # Layout, UI primitives, dashboard widgets
│   │   ├── context/AuthContext.jsx
│   │   ├── pages/              # Home, Login, Register, Dashboard, Projects, Tasks, Members, Invitations, Settings, ...
│   │   ├── App.jsx             # Route definitions
│   │   └── main.jsx            # React entry point
│   ├── index.html
│   ├── vite.config.js          # Dev server fixed to port 5173
│   ├── tailwind.config.js
│   └── package.json
│
├── docs/                       # In-depth design/architecture notes (may describe historical/in-progress states)
└── README.md                   # This file
```

---

## API Overview

Base URL: `http://localhost:5000/api`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | No | Health check |
| POST | `/auth/register` | No | Register company + owner user |
| POST | `/auth/login` | No | Email/password login |
| POST | `/auth/register/invitation` | No | Complete signup from an invitation |
| GET | `/auth/me` | Yes | Current user info |
| GET | `/auth/google` | No | Start Google OAuth |
| GET | `/auth/google/callback` | No | Google OAuth callback |
| GET | `/organization/members` | Yes | List organization members |
| POST | `/organization/invitations` | Yes (owner/admin) | Invite a member |
| GET | `/organization/invitations` | Yes | List invitations |
| POST | `/organization/invitations/:token/accept` | Yes | Accept an invitation |
| POST | `/projects` | Yes (owner/admin/manager) | Create project |
| GET | `/projects` | Yes | List projects |
| GET | `/projects/:id` | Yes | Get project |
| PUT | `/projects/:id` | Yes (owner/admin/manager) | Update project |
| DELETE | `/projects/:id` | Yes (owner/admin) | Delete project |
| GET | `/projects/:id/members` | Yes | List project members |
| POST | `/projects/:projectId/members` | Yes (owner/admin/manager) | Add project member |
| PUT | `/projects/:id/members/:userId` | Yes (owner/admin/manager) | Update project member role |
| DELETE | `/projects/:id/members/:userId` | Yes (owner/admin/manager) | Remove project member |
| POST | `/projects/:projectId/tasks` | Yes | Create task |
| GET | `/projects/:projectId/tasks` | Yes | List tasks |
| GET | `/projects/:projectId/tasks/:taskId` | Yes | Get task |
| PUT | `/projects/:projectId/tasks/:taskId` | Yes | Update task |
| DELETE | `/projects/:projectId/tasks/:taskId` | Yes | Delete task |

More detail (request/response shapes) is in [docs/API.md](docs/API.md), though note some `docs/*.md` files describe earlier/in-progress states of the code and may not reflect the current implementation exactly — the source files listed above are authoritative.

---

## Troubleshooting

**Database connection error (`❌ Unable to connect to the database`)**
- Confirm MySQL is running (Windows: check the `MySQL80` service in `services.msc`).
- Confirm `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` in `.env` match your local MySQL setup.
- Confirm the database exists: `npx sequelize-cli db:create` (or create it manually).

**Port already in use**
```powershell
netstat -ano | findstr :5000
taskkill /PID <pid> /F
```
Or change `PORT` in `Task-Manager-Backend/.env` (and update `GOOGLE_CALLBACK_URL` to match if you use Google login). For the frontend, change `server.port` in [vite.config.js](Task-Manager-Frontend/vite.config.js) (default `5173`).

**`npm install` errors**
- Confirm Node.js 18+ is installed (`node -v`).
- Delete `node_modules` and `package-lock.json`-based cache issues by re-running `npm install` from a clean shell.
- Native module issues (e.g. `bcryptjs`, `mysql2`) are rare since both are pure-JS, but ensure you're on a 64-bit Node install.

**Migration errors**
- Run `npx sequelize-cli db:migrate:status` to see which migrations are pending/applied.
- Ensure `.env` is present and correct — [config/config.js](Task-Manager-Backend/config/config.js) reads DB credentials from it via `dotenv`.
- If a migration partially failed, `npx sequelize-cli db:migrate:undo` the last one and retry.

**CORS error in the browser**
- The backend uses `app.use(cors())` in [index.js](Task-Manager-Backend/index.js) with no origin restriction, so all origins are allowed by default. If you've since added an `origin` option there, make sure it includes `http://localhost:5173`.

**Frontend cannot connect to backend**
1. Confirm the backend is running: `curl http://localhost:5000/api/health`.
2. Confirm the frontend's hardcoded API URL in [src/api/client.js](Task-Manager-Frontend/src/api/client.js) (`http://localhost:5000/api`) matches the backend's actual host/port.
3. Check the browser console/network tab for the actual failing request.

**Authentication not working**
- Check `JWT_SECRET` is set in `.env` (server restarts required after editing `.env`).
- For Google login specifically, confirm `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_CALLBACK_URL`/`FRONTEND_URL` are all set and the callback URL is registered in Google Cloud Console.
- A `401 Invalid or expired token` means the token is missing, malformed, or `JWT_SECRET` changed since it was issued (e.g. after generating a new secret) — log in again.

**Missing environment variables**
- Compare your `Task-Manager-Backend/.env` against [.env.example](Task-Manager-Backend/.env.example) — every non-Google variable should be present.

---

## Production Build

**Frontend:**
```bash
cd Task-Manager-Frontend
npm run build      # outputs static files to dist/
npm run preview    # optional: serve the build locally to sanity-check it
```
Serve `dist/` with any static file host/CDN. Because the API base URL is hardcoded to `http://localhost:5000/api`, you must edit [src/api/client.js](Task-Manager-Frontend/src/api/client.js) to point at your real backend URL before building for a non-local environment.

**Backend:**
```bash
cd Task-Manager-Backend
npm start          # node index.js
```
Set `.env` with production database credentials, a strong `JWT_SECRET`/`SESSION_SECRET`, and (if used) production Google OAuth credentials with a production `GOOGLE_CALLBACK_URL` and `FRONTEND_URL`. There is no separate production build step for the backend (plain Node, no bundler/transpiler).

---

## Security Notes

- **Never commit `.env`.** It's already listed in [.gitignore](.gitignore) (`.env`, `.env.local`, `.env.*.local`, with `.env.example` explicitly un-ignored) and is confirmed **not** tracked in this repository's git history.
- Never commit real database passwords, JWT secrets, or Google OAuth client secrets — use `.env.example` as the template and fill in real values only in your local, untracked `.env`.
- Generate a strong, random `JWT_SECRET` and `SESSION_SECRET` per environment (e.g. `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`).
- Change default/example database credentials (`root`/blank or weak passwords) before any shared or production deployment.
- If Google OAuth credentials were ever shared outside your team (chat, email, screenshots), rotate them in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
- Do not expose production credentials in development `.env` files or vice versa.

---

## Development Notes

- `docs/` contains earlier architecture/database/auth analysis notes. Some of it (e.g. references to a "critical finding" about broken auth) describes a **past** state of the code — the current [authController.js](Task-Manager-Backend/controllers/authController.js) already implements `AuthIdentity`, `OrganizationMember`, and Google OAuth correctly. Treat `docs/*.md` as historical context, not a live spec.
- No automated tests or linting are currently configured for either package.
- No seeders exist — after migrations, the database is empty; register a new company through the UI/API to get started.

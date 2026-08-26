# Deploying to Railway

This guide walks through deploying both **Task-Manager-Backend** (Express + Sequelize + MySQL) and **Task-Manager-Frontend** (React + Vite) to [Railway](https://railway.app), plus the MySQL database itself.

Repo layout assumed:
```
Task Management System/
├── Task-Manager-Backend/
└── Task-Manager-Frontend/
```

Railway does **not** auto-detect a monorepo's subfolders by default, so each app will be created as its own Railway **service**, pointed at the same GitHub repo but with a different **Root Directory**.

---

## 0. Prerequisites

- Push this repo to GitHub (Railway deploys from a GitHub repo, or via the Railway CLI).
- A [Railway](https://railway.app) account (sign in with GitHub).
- Optional: [Railway CLI](https://docs.railway.com/guides/cli) — `npm i -g @railway/cli` — if you prefer deploying from your terminal instead of the dashboard.

---

## 1. Create the Project and MySQL database

1. Go to the Railway dashboard → **New Project**.
2. Choose **Provision MySQL** (or **New → Database → Add MySQL**) — this creates a managed MySQL instance inside the project.
3. Click the MySQL service → **Variables** tab. Note the auto-generated variables: `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE` (also exposed as `MYSQL_URL`). You'll reference these from the backend service in step 3.

---

## 2. Deploy the Backend (`Task-Manager-Backend`)

### 2.1 Create the service
1. In the same Railway project: **New → GitHub Repo** → select this repository.
2. Once created, open the service → **Settings**:
   - **Root Directory**: `Task-Manager-Backend`
   - **Start Command**: `node index.js` (Railway will otherwise run `npm start`, which already maps to this — either works since [package.json](Task-Manager-Backend/package.json) defines `"start": "node index.js"`)
   - Build: no build step needed (plain Node app), Railway's Nixpacks builder will just run `npm install`.

### 2.2 Set environment variables
Go to the backend service → **Variables** and add (reference [.env.example](Task-Manager-Backend/.env.example) for the full list):

| Variable | Value |
|---|---|
| `PORT` | Leave unset — Railway injects its own `PORT` and the app already reads `process.env.PORT` ([index.js:53](Task-Manager-Backend/index.js#L53)) |
| `DB_HOST` | `${{MySQL.MYSQLHOST}}` (Railway variable reference — click "Add Reference") |
| `DB_PORT` | `${{MySQL.MYSQLPORT}}` |
| `DB_NAME` | `${{MySQL.MYSQLDATABASE}}` |
| `DB_USER` | `${{MySQL.MYSQLUSER}}` |
| `DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |
| `JWT_SECRET` | a long random string |
| `JWT_EXPIRES_IN` | `7d` |
| `SESSION_SECRET` | a long random string |
| `GOOGLE_CLIENT_ID` | (optional, if using Google login) |
| `GOOGLE_CLIENT_SECRET` | (optional) |
| `GOOGLE_CALLBACK_URL` | `https://<your-backend>.up.railway.app/api/auth/google/callback` |
| `FRONTEND_URL` | `https://<your-frontend>.up.railway.app` (set after step 3, then redeploy) |

> Railway lets you reference another service's variables with `${{ServiceName.VAR_NAME}}` instead of copy-pasting — pick "MySQL" from the reference picker in the Variables UI.

### 2.3 Networking
- Settings → **Networking** → **Generate Domain** to get a public `*.up.railway.app` URL for the API.
- The app binds to `0.0.0.0` on `process.env.PORT` automatically via Express/`http.createServer` ([index.js:54](Task-Manager-Backend/index.js#L54)) — no code change needed.

### 2.4 Run database migrations
This project uses Sequelize migrations (no auto-`sync()` at startup), so tables must be created explicitly against the Railway MySQL instance. Two options:

**Option A — Railway CLI (recommended, one-time):**
```bash
railway login
railway link          # select this project
railway run --service Task-Manager-Backend npx sequelize-cli db:migrate
```

**Option B — temporarily add a release step**, in the backend's `package.json` scripts, e.g. run migrations before start:
```json
"start": "npx sequelize-cli db:migrate && node index.js"
```
Since migrations are idempotent (Sequelize tracks applied ones in `SequelizeMeta`), this is safe to leave in place for future deploys too if you'd rather not run it manually each time.

### 2.5 Uploads / file storage caveat
[index.js:24](Task-Manager-Backend/index.js#L24) serves local files from `./uploads` via `multer`. Railway's filesystem is **ephemeral** — anything written to disk (uploaded attachments) is lost on every redeploy/restart. For production, move file uploads to an object store (e.g. Cloudflare R2, AWS S3, Railway's volume feature for a single-instance persistent disk) before relying on this in production. This guide does not change that code — flagging it so it doesn't surprise you after deploying.

---

## 3. Deploy the Frontend (`Task-Manager-Frontend`)

### 3.1 Create the service
1. In the same Railway project: **New → GitHub Repo** → same repository again (as a second service).
2. Settings:
   - **Root Directory**: `Task-Manager-Frontend`
   - **Build Command**: `npm run build`
   - **Start Command**: use a static file server, since `vite preview` isn't meant for production. Easiest: install [`serve`](https://www.npmjs.com/package/serve) at deploy time:
     ```
     npx serve -s dist -l $PORT
     ```
   - This requires no dependency changes — `npx` fetches `serve` on demand during the start command.

### 3.2 Set environment variables
| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://<your-backend>.up.railway.app/api` |

This overrides the hardcoded fallback in [src/api/client.js:5](Task-Manager-Frontend/src/api/client.js#L5). Vite bakes `VITE_*` vars in at **build time**, so set this before the first deploy/build.

### 3.3 Networking
- Settings → **Networking** → **Generate Domain** for the public frontend URL.

### 3.4 Socket.IO
[src/lib/socket.js](Task-Manager-Frontend/src/lib/socket.js) connects to `API_ORIGIN` (the backend URL, derived from `VITE_API_URL`), so no extra config is needed — it will automatically point at your Railway backend once `VITE_API_URL` is set correctly.

---

## 4. Wire the two services together (CORS + OAuth)

1. Backend currently uses `app.use(cors())` with no origin restriction ([index.js:21](Task-Manager-Backend/index.js#L21)), so cross-origin requests from the frontend's Railway domain will work out of the box. (Optional hardening: restrict `cors()` to `{ origin: process.env.FRONTEND_URL }` once you know the final frontend domain.)
2. Set the backend's `FRONTEND_URL` variable to the frontend's Railway domain (used for the Google OAuth redirect back to the app) and redeploy the backend.
3. If using Google Sign-In, update the OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) with the new authorized redirect URI: `https://<your-backend>.up.railway.app/api/auth/google/callback`.

---

## 5. Verify the deployment

1. Backend health check: `https://<your-backend>.up.railway.app/api/health` → should return `{"status":"ok","message":"Server is running"}` ([index.js:38-43](Task-Manager-Backend/index.js#L38-L43)).
2. Frontend: open `https://<your-frontend>.up.railway.app`, confirm login/register works and data loads (network tab should hit the backend domain, not `hostingersite.com`).
3. Check Railway logs (each service → **Deployments** → view logs) for DB connection errors or missing env vars.

---

## 6. Ongoing deploys

Both services are connected to the GitHub repo — every push to the tracked branch (default: your default branch) triggers Railway to rebuild and redeploy that service automatically. Since each service's Root Directory is scoped to its own folder, a backend-only change won't trigger a pointless frontend rebuild and vice versa (Railway skips a service if nothing under its watched path changed).

---

## Quick reference: environment variables

**Backend** (`Task-Manager-Backend`)
```
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
JWT_SECRET=<random-long-string>
JWT_EXPIRES_IN=7d
SESSION_SECRET=<random-long-string>
GOOGLE_CLIENT_ID=<optional>
GOOGLE_CLIENT_SECRET=<optional>
GOOGLE_CALLBACK_URL=https://<backend-domain>/api/auth/google/callback
FRONTEND_URL=https://<frontend-domain>
```

**Frontend** (`Task-Manager-Frontend`)
```
VITE_API_URL=https://<backend-domain>/api
```

# Humancare Connect — Frontend

## Setup

1. Make sure your backend (`project-server`) is running on `http://localhost:5000`
   — the login/register forms call it directly.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open the URL it prints (usually `http://localhost:5173`).

## What's here

- `/` — Homepage with "Get started" / "Log in"
- `/register` — Creates a company + first user (calls `POST /api/auth/register`)
- `/login` — Logs in an existing user (calls `POST /api/auth/login`)
- `/dashboard` — Protected placeholder; redirects to `/login` if not authenticated

Auth state lives in `src/context/AuthContext.jsx` and persists in `localStorage`
(token + user). The JWT is attached to every API request automatically via the
axios interceptor in `src/api/client.js`.

## Next up

Once this is running and you can register → land on the dashboard, the next
piece is building out the actual Projects and Tasks screens on top of this
same pattern (API call → state → render).

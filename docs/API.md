# API.md — Task Management System

All routes are mounted in [index.js](../Task-Manager-Backend/index.js). Base URL (dev): `http://localhost:5000` (see [.env.example](../Task-Manager-Backend/.env.example) `PORT=5000`, and frontend [api/client.js](../Task-Manager-Frontend/src/api/client.js) `baseURL: "http://localhost:5000/api"`).

Only the routes below exist in the codebase — nothing else has been implemented.

| Method | Endpoint | Middleware | Controller | Model(s) touched | Purpose |
|---|---|---|---|---|---|
| GET | `/api/health` | none | inline handler in `index.js` | none | Liveness check |
| POST | `/api/auth/register` | none | `authController.register` | `User`, `Organization` (intended: also `AuthIdentity`, `OrganizationMember` — not currently written) | Create a company + its first (owner) user |
| POST | `/api/auth/login` | none | `authController.login` | `User` (intended: also `AuthIdentity` — not currently read) | Authenticate an existing user, issue a JWT |

No route in the codebase uses `authMiddleware.requireAuth` — there are currently **zero protected endpoints**.

---

## `GET /api/health`

- **Auth required:** No
- **Middleware:** None
- **Handler:** inline in [index.js:14-16](../Task-Manager-Backend/index.js)
- **Request:** none
- **Response `200`:**
  ```json
  { "status": "ok", "message": "Server is running" }
  ```

---

## `POST /api/auth/register`

- **Auth required:** No
- **Middleware:** None
- **Route:** [routes/authRoutes.js:5](../Task-Manager-Backend/routes/authRoutes.js)
- **Controller:** [controllers/authController.js:18-63](../Task-Manager-Backend/controllers/authController.js) (`register`)

**Request body:**
```json
{
  "company_name": "string (required)",
  "first_name": "string (required)",
  "last_name": "string (optional)",
  "email": "string (required)",
  "password": "string (required)"
}
```
(Matches [Register.jsx](../Task-Manager-Frontend/src/pages/Register.jsx) form fields.)

**Controller logic (traced):**
1. Validate `company_name`, `first_name`, `email`, `password` are present → `400` if not.
2. `User.findOne({ where: { email } })` — if found, → `409 "Email already in use."`
3. Build a `slug` from `company_name` (lowercased, spaces→`-`) + `Date.now()`.
4. `Organization.create({ name: company_name, slug })`.
5. `bcrypt.hash(password, 10)` → `password_hash`.
6. `User.create({ organization_id, first_name, last_name, email, password_hash, role: "owner" })`
   — ⚠️ **`organization_id`, `password_hash`, and `role` are not real columns on `User`; Sequelize silently drops them.** See [AUTHENTICATION.md](AUTHENTICATION.md#critical-finding).
7. `generateToken(user)` → signs a JWT with `{ id, organization_id, role }` (last two are `undefined` in practice).

**Response `201`:**
```json
{
  "token": "string",
  "user": {
    "id": "number",
    "first_name": "string",
    "last_name": "string",
    "email": "string",
    "role": null,
    "organization_id": null
  }
}
```
(`role`/`organization_id` will actually be `undefined`/absent due to the mismatch above — shown as `null` here for illustration only.)

**Error responses:**
| Status | Condition | Body |
|---|---|---|
| 400 | Missing required field | `{ "message": "Missing required fields." }` |
| 409 | Email already registered | `{ "message": "Email already in use." }` |
| 500 | Unhandled exception | `{ "message": "Server error during registration." }` |

---

## `POST /api/auth/login`

- **Auth required:** No
- **Middleware:** None
- **Route:** [routes/authRoutes.js:6](../Task-Manager-Backend/routes/authRoutes.js)
- **Controller:** [controllers/authController.js:66-101](../Task-Manager-Backend/controllers/authController.js) (`login`)

**Request body:**
```json
{
  "email": "string (required)",
  "password": "string (required)",
  "remember_me": "boolean (sent by frontend, ignored by backend)"
}
```

**Controller logic (traced):**
1. Validate `email`/`password` present → `400` if not.
2. `User.findOne({ where: { email } })` → `401` if not found.
3. `bcrypt.compare(password, user.password_hash)` — ⚠️ `user.password_hash` does not exist on the `User` model/table, so this is always `undefined`; `bcryptjs` throws on a non-string hash, which is caught and returned as a `500`.
4. If (hypothetically) matched, `generateToken(user)` and respond `200`.

**Response `200` (intended, currently unreachable in practice):**
```json
{
  "token": "string",
  "user": {
    "id": "number",
    "first_name": "string",
    "last_name": "string",
    "email": "string",
    "role": "string",
    "organization_id": "number"
  }
}
```

**Error responses:**
| Status | Condition | Body |
|---|---|---|
| 400 | Missing email/password | `{ "message": "Email and password are required." }` |
| 401 | No user with that email | `{ "message": "Invalid email or password." }` |
| 401 | Password mismatch (only reachable once the write path is fixed) | `{ "message": "Invalid email or password." }` |
| 500 | Unhandled exception (currently the actual outcome, due to undefined `password_hash`) | `{ "message": "Server error during login." }` |

---

## Endpoints referenced by the frontend but NOT implemented in the backend

| Method | Endpoint | Referenced in | Status |
|---|---|---|---|
| GET/redirect | `/api/auth/google` | [Login.jsx](../Task-Manager-Frontend/src/pages/Login.jsx) `handleGoogleLogin()` | ❌ NOT IMPLEMENTED — no matching route in `authRoutes.js` |

---

## Backend Request Flow (generic, current architecture)

```text
Frontend (Axios, src/api/client.js)
   ↓  HTTP request (+ Authorization header if token present)
Express app (index.js) — cors(), express.json()
   ↓
Route file (routes/authRoutes.js)
   ↓
[No middleware currently attached to any route]
   ↓
Controller (controllers/authController.js)
   ↓
Model (Sequelize: User / Organization)
   ↓
MySQL database
   ↓
JSON response
   ↓
Frontend
```

There is **no service layer** — controllers call Sequelize models directly. This is noted as a gap in [ARCHITECTURE.md](ARCHITECTURE.md), not invented as something that currently exists.

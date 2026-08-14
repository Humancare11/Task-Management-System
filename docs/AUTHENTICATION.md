# AUTHENTICATION.md — Task Management System

Traced from [authRoutes.js](../Task-Manager-Backend/routes/authRoutes.js), [authController.js](../Task-Manager-Backend/controllers/authController.js), [authMiddleware.js](../Task-Manager-Backend/middleware/authMiddleware.js), and the frontend [AuthContext.jsx](../Task-Manager-Frontend/src/context/AuthContext.jsx) / [api/client.js](../Task-Manager-Frontend/src/api/client.js).

---

## Critical Finding

> **`authController.js` targets a database shape that no longer exists.** This is documented in depth here because it affects every claim below about "how login works."

`register()` calls:

```js
const user = await User.create({
  organization_id: organization.id,
  first_name, last_name, email,
  password_hash,
  role: "owner",
});
```

But [models/User.js](../Task-Manager-Backend/models/User.js) defines only: `id, first_name, last_name, email, phone, avatar_url, email_verified_at, is_active, last_login_at`. There is **no** `organization_id`, `role`, or `password_hash` attribute on the `User` model — those fields now live on `OrganizationMember` and `AuthIdentity` respectively (see [DATABASE.md](DATABASE.md)).

**Consequence:**
- Sequelize silently ignores attributes not defined on the model when calling `.create()` — no error is thrown.
- The `users` row is created with a name/email but **no password is ever stored anywhere**.
- No `OrganizationMember` row is created, so the new "owner" is never actually linked to the `Organization` that was just created.
- `generateToken(user)` reads `user.organization_id` and `user.role`, both `undefined` on the returned instance, so the issued JWT's payload is `{ id, organization_id: undefined, role: undefined }`.
- On a subsequent `login()` call, `bcrypt.compare(password, user.password_hash)` is evaluated with `user.password_hash === undefined`. `bcryptjs` throws/rejects when the hash argument isn't a string, which is caught by the surrounding `try/catch` and returned as `500 { message: "Server error during login." }`.

**Net result: `POST /api/auth/register` returns `201` but produces an unusable account, and `POST /api/auth/login` currently fails (500) for any account.** This should be the #1 fix — see [DEVELOPMENT-ROADMAP.md](DEVELOPMENT-ROADMAP.md).

---

## Authentication Flow (as coded today)

```text
User
 ↓
Frontend: Register.jsx / Login.jsx (src/pages)
 ↓
POST /api/auth/register  or  POST /api/auth/login   (src/api/client.js, axios)
 ↓
index.js  →  app.use("/api/auth", authRoutes)
 ↓
routes/authRoutes.js  →  router.post("/register", register) / router.post("/login", login)
 ↓
controllers/authController.js
   register(): User.findOne (dup check) → Organization.create → bcrypt.hash → User.create → jwt.sign
   login():    User.findOne → bcrypt.compare → jwt.sign
 ↓
Response: { token, user: { id, first_name, last_name, email, role, organization_id } }
 ↓
Frontend: AuthContext.login(token, user) → localStorage["token"], localStorage["user"]
 ↓
Subsequent requests: api/client.js axios interceptor reads localStorage["token"]
                      and attaches `Authorization: Bearer <token>`
 ↓
Backend: middleware/authMiddleware.js → requireAuth (verifies JWT) — but not attached to any route
```

---

## Feature-by-Feature Status

| Feature | Status | Evidence |
|---|---|---|
| Registration (create org + user) | 🟡 PARTIALLY IMPLEMENTED | Route/controller exist ([authController.js:18-63](../Task-Manager-Backend/controllers/authController.js)) but writes to non-existent `User` fields — see Critical Finding |
| Login | 🟡 PARTIALLY IMPLEMENTED (currently broken) | [authController.js:66-101](../Task-Manager-Backend/controllers/authController.js) — will 500 due to undefined `password_hash` |
| Password hashing | 🟡 PARTIALLY IMPLEMENTED | `bcrypt.hash` is called correctly during register, but the result is never persisted to a real column |
| JWT generation | ✅ IMPLEMENTED | `generateToken()` in [authController.js:6-12](../Task-Manager-Backend/controllers/authController.js), signs `{id, organization_id, role}` with `JWT_SECRET` / `JWT_EXPIRES_IN` from `.env` |
| JWT verification middleware | 🟡 PARTIALLY IMPLEMENTED | `requireAuth` exists in [authMiddleware.js](../Task-Manager-Backend/middleware/authMiddleware.js) and correctly verifies via `jwt.verify`, but is not imported/used by any route — there are zero protected backend endpoints today |
| AuthIdentity usage | ❌ NOT IMPLEMENTED | Model and migration exist; no controller ever creates/reads an `AuthIdentity` row |
| Organization membership on signup | ❌ NOT IMPLEMENTED | No `OrganizationMember` row is created during `register()` |
| Multi-provider auth (Google OAuth) | ❌ NOT IMPLEMENTED | `AuthIdentity.provider` ENUM includes `'google'`, and [Login.jsx](../Task-Manager-Frontend/src/pages/Login.jsx) has a "Sign in with Google" button that redirects to `/api/auth/google` — **no such backend route exists** |
| Authorization (role/permission checks) | ❌ NOT IMPLEMENTED | No code reads `OrganizationMember.role` to gate any action |
| Logout | ✅ IMPLEMENTED (client-side only) | `AuthContext.logout()` clears `localStorage` — there is no server-side session/token invalidation because JWTs are stateless; nothing to invalidate server-side is expected in this design |
| "Remember me" | ❌ NOT IMPLEMENTED (backend) | [Login.jsx](../Task-Manager-Frontend/src/pages/Login.jsx) sends `remember_me` in the request body; `authController.login` never reads it |
| Frontend route protection | ✅ IMPLEMENTED | [ProtectedRoute.jsx](../Task-Manager-Frontend/src/components/ProtectedRoute.jsx) redirects to `/login` if no `user` in `AuthContext` |
| Backend route protection | ❌ NOT IMPLEMENTED | No route in `authRoutes.js` (or anywhere) uses `requireAuth` |
| Email verification | ❌ NOT IMPLEMENTED | `User.email_verified_at` column exists but nothing ever sets it |
| Last login tracking | ❌ NOT IMPLEMENTED | `User.last_login_at` column exists but `login()` never updates it |

---

## JWT Details

- **Secret / expiry:** read from `process.env.JWT_SECRET` and `process.env.JWT_EXPIRES_IN` (defaults to `"7d"` if unset) — see [.env.example](../Task-Manager-Backend/.env.example).
- **Payload (intended):** `{ id, organization_id, role }` — in practice `organization_id` and `role` are `undefined` today due to the Critical Finding above.
- **Transport:** `Authorization: Bearer <token>` header, attached automatically by the Axios interceptor in [api/client.js](../Task-Manager-Frontend/src/api/client.js).
- **Storage on client:** raw JWT string in `localStorage["token"]` (not an httpOnly cookie) — ❓ UNKNOWN whether this is an intentional tradeoff or something to revisit; worth flagging as an XSS-exposure consideration if this becomes a security-sensitive product.
- **Verification:** `jwt.verify(token, process.env.JWT_SECRET)` in `requireAuth`; on success `req.user` is set to the decoded payload. Currently unreachable because no route uses this middleware.

---

## Error Handling Observed

| Scenario | HTTP Status | Message |
|---|---|---|
| Register: missing `company_name`/`first_name`/`email`/`password` | 400 | "Missing required fields." |
| Register: email already exists | 409 | "Email already in use." |
| Register: unhandled exception | 500 | "Server error during registration." |
| Login: missing email/password | 400 | "Email and password are required." |
| Login: user not found | 401 | "Invalid email or password." |
| Login: password mismatch (or, currently, `password_hash` undefined) | 401 or 500 | "Invalid email or password." / "Server error during login." |
| No JWT provided (if `requireAuth` were attached) | 401 | "No token provided." |
| Invalid/expired JWT | 401 | "Invalid or expired token." |

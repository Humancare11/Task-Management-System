# PROJECT-FLOW.md — Task Management System

User-facing flows, traced from actual frontend pages and backend controllers.

---

## Registration Flow

```text
User visits "/" (Home.jsx) → clicks "Get started" / "Start for free"
 ↓
"/register" (Register.jsx) — fills company_name, first_name, last_name, email, password
 ↓
Client-side check: acceptedTerms must be checked, else inline error, no request sent
 ↓
axios POST /api/auth/register (api/client.js)
 ↓
authController.register (Task-Manager-Backend/controllers/authController.js)
   → validates required fields
   → checks for existing email
   → creates Organization row
   → hashes password with bcrypt
   → creates User row  ⚠️ password_hash/role/organization_id silently dropped (see AUTHENTICATION.md)
   → signs JWT
 ↓
Response { token, user }
 ↓
AuthContext.login(token, user) → writes to localStorage
 ↓
navigate("/dashboard")
```

**Status:** 🟡 PARTIALLY IMPLEMENTED — the UI flow and route wiring are complete, but the resulting account has no stored password and no organization membership row (see [AUTHENTICATION.md](AUTHENTICATION.md#critical-finding)).

---

## Login Flow

```text
"/login" (Login.jsx) — fills email, password, optional remember_me checkbox
 ↓
axios POST /api/auth/login
 ↓
authController.login
   → find user by email
   → bcrypt.compare(password, user.password_hash)   ⚠️ password_hash is undefined
   → (intended) sign JWT, return { token, user }
 ↓
AuthContext.login(token, user) → localStorage
 ↓
navigate("/dashboard")
```

**Status:** 🟡 PARTIALLY IMPLEMENTED (currently broken) — `bcrypt.compare` against an `undefined` hash causes a `500` response for every login attempt today. See [AUTHENTICATION.md](AUTHENTICATION.md#critical-finding).

**Google login button:** present in the UI, redirects the browser to `/api/auth/google`. ❌ NOT IMPLEMENTED on the backend — clicking it will hit a 404.

---

## Organization Flow

```text
User
 ↓
Organization (created automatically during registration, one per signup)
 ↓
Organization Membership   ❌ NOT IMPLEMENTED — no OrganizationMember row is ever created
 ↓
Role                      ❌ NOT IMPLEMENTED — role is intended to live on OrganizationMember, never set
```

There is currently no UI or API for: inviting teammates to an existing organization, listing an organization's members, changing a member's role, or switching between multiple organizations. All of this is 🔵 PROPOSED — see [DEVELOPMENT-ROADMAP.md](DEVELOPMENT-ROADMAP.md).

---

## Dashboard Flow (post-login)

```text
"/dashboard" (Dashboard.jsx), wrapped in ProtectedRoute
 ↓
ProtectedRoute reads AuthContext.user
   → if null, redirect to "/login"
   → if present, render Dashboard.jsx
 ↓
Dashboard.jsx displays user.first_name and user.role, and a "Log out" button
   → logout() clears localStorage and AuthContext state
```

**Status:** ✅ IMPLEMENTED as a shell only — the page itself states "projects and task boards get built here next" ([Dashboard.jsx:28-29](../Task-Manager-Frontend/src/pages/Dashboard.jsx)). No real dashboard content exists.

---

## Project Flow

**Status: ❌ NOT IMPLEMENTED.** No `Project` model, migration, route, or UI page exists anywhere in the repository.

**🔵 PROPOSED future flow:**
```text
User (with an org membership)
 ↓
Select/confirm current Organization
 ↓
Create/View Projects (scoped to that organization)
 ↓
Add Project Members (subset of org members)
 ↓
Project Dashboard → Task Board
```

---

## Task Flow

**Status: ❌ NOT IMPLEMENTED.** No `Task` model, migration, route, or UI page exists anywhere in the repository.

**🔵 PROPOSED future flow:**
```text
User (project member)
 ↓
Open a Project
 ↓
Create Task (title, description, status, priority, assignee, due date)
 ↓
Task moves through Status column (e.g., Kanban board)
 ↓
Task Activity (status changes, comments, attachments) — all proposed, none modeled today
 ↓
Notifications to assignee/watchers — proposed, not modeled today
```

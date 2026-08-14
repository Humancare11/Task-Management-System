# DEVELOPMENT-ROADMAP.md — Task Management System

Assessment based strictly on the current repository state as analyzed on 2026-08-12.

---

## Component Status Matrix

| Component | Status | Evidence | Recommendation |
|---|---|---|---|
| Users | 🟡 PARTIALLY IMPLEMENTED | `User` model + migration exist and are correct; but no code path stores a password for a user | Fix write path (see Roadmap #1) |
| Organizations | 🟡 PARTIALLY IMPLEMENTED | `Organization` model + migration exist; created on signup, but no owner is ever linked | Fix write path (see Roadmap #1) |
| Organization Members / Roles | ❌ NOT WIRED UP | `OrganizationMember` model + migration exist (role ENUM included) but zero controllers touch this table | Populate on registration; add membership management endpoints |
| Auth Identities (password/OAuth) | ❌ NOT WIRED UP | `AuthIdentity` model + migration exist; controller never reads/writes it | Rewrite `authController` to use it |
| Permissions / Authorization | ❌ NOT IMPLEMENTED | No middleware checks role or org membership; `requireAuth` isn't even attached to a route | Build after auth fix |
| Projects | ❌ NOT IMPLEMENTED | No model, migration, route, or UI | Build (Phase 5) |
| Project Members | ❌ NOT IMPLEMENTED | Depends on Projects | Build (Phase 5) |
| Tasks | ❌ NOT IMPLEMENTED | No model, migration, route, or UI | Build (Phase 6) |
| Task Status / Priority | ❌ NOT IMPLEMENTED | No fields defined anywhere | Design as part of Task model |
| Task Assignment | ❌ NOT IMPLEMENTED | — | Build (Phase 6) |
| Task Comments | ❌ NOT IMPLEMENTED | — | Build (Phase 6+) |
| Task Attachments | ❌ NOT IMPLEMENTED | — | Build (Phase 6+, needs file storage decision) |
| Task Labels | ❌ NOT IMPLEMENTED | — | Build (Phase 6+) |
| Task Activity / Audit Log | ❌ NOT IMPLEMENTED | — | Build (Phase 6+) |
| Notifications | ❌ NOT IMPLEMENTED | — | Build (Phase 7+) |
| Teams (sub-groups within an org) | ❓ UNKNOWN / not modeled | No `Team` model exists; org roles include `manager`/`client` which hint at team-like structuring, but nothing is built | Defer until Projects/Tasks exist |
| Frontend: Auth pages | ✅ IMPLEMENTED (UI) | `Login.jsx`, `Register.jsx`, `AuthLayout.jsx`, `FormField.jsx` | Keep once backend is fixed |
| Frontend: Dashboard | 🟡 PLACEHOLDER ONLY | `Dashboard.jsx` shows a static welcome message | Build real content after Projects/Tasks exist |
| Frontend: Route protection | ✅ IMPLEMENTED | `ProtectedRoute.jsx` | — |
| Backend: Route protection | ❌ NOT IMPLEMENTED | `requireAuth` unused | Attach to all non-auth routes going forward |
| Testing (backend or frontend) | ❌ NOT IMPLEMENTED | No test files, no test script in either `package.json` | Add once core flows are correct |

---

## Rough Progress Assessment

```text
Database schema (identity/org)   ████████░░ 80%   (modeled + migrated; Project/Task tables don't exist)
Authentication (write path)      ███░░░░░░░ 30%   (routes/JWT scaffolding present; actual persistence broken)
Authorization                    ░░░░░░░░░░  0%   (no role/org checks anywhere)
Organizations (membership mgmt)  ██░░░░░░░░ 20%   (schema only, never populated)
Projects                         ░░░░░░░░░░  0%
Tasks                            ░░░░░░░░░░  0%
Frontend (auth + shell)          ████░░░░░░ 40%   (auth UI solid; dashboard/product surface is a placeholder)
Testing                          ░░░░░░░░░░  0%
```

These are qualitative estimates based on what exists in the repo, not a formal metric.

---

## Roadmap Phases

### Phase 1 — Foundation
- ✅ Done: Express app bootstrap, MySQL connection, Sequelize migrations tooling (`.sequelizerc`, `config/config.js`), CORS + JSON body parsing, health check endpoint.
- Missing: none critical for this phase.

### Phase 2 — Authentication (fix before anything else)
- 🟡 Partially done: routes, JWT signing/verification code, bcrypt dependency, password UI.
- **Missing / CRITICAL:** rewrite `authController.register`/`login` to use `AuthIdentity.password_hash` instead of a non-existent `User.password_hash`, and to create an `OrganizationMember` row (`role: "owner"`) instead of a non-existent `User.role`/`User.organization_id`.
- Dependency: none — this only touches existing models.

### Phase 3 — Authorization
- Missing entirely: attach `authMiddleware.requireAuth` to future protected routes; add a role/org-scope check (e.g., middleware that loads the caller's `OrganizationMember` row and enforces role requirements).
- Dependency: Phase 2 must be correct first (JWT payload needs a real `organization_id`).

### Phase 4 — Organization Management
- Missing: endpoints to list an organization's members, invite a teammate (create an `OrganizationMember` for an existing/new user), change a member's role, and a frontend "current organization" concept.
- Dependency: Phase 2 + 3.

### Phase 5 — Projects
- Missing: `Project` model/migration (likely FK to `organizations`), `ProjectMember` join table, CRUD routes/controllers, frontend project list/detail pages.
- Dependency: Organizations working end-to-end.

### Phase 6 — Tasks
- Missing: `Task` model/migration (FK to `projects`, assignee FK to `users`, status/priority fields), CRUD routes/controllers, a board/list UI.
- Dependency: Projects.

### Phase 7 — Frontend Expansion
- Missing: real dashboard content, project/task UI, org switcher/settings.
- Dependency: Phases 4–6 backend endpoints existing.

### Phase 8 — Testing
- Missing entirely: no test runner configured in either `package.json`. Add unit/integration tests once the auth write-path is fixed, so tests aren't written against known-broken behavior.

### Phase 9 — Security Hardening
- Missing: rate limiting on auth endpoints, input validation library (e.g. schema validation on request bodies — currently only manual `if (!field)` checks), consistent error handling, secrets management review (`.env` currently holds `JWT_SECRET`/DB creds in plaintext, which is normal for dev but should be revisited for production), reconsidering JWT storage in `localStorage` vs. httpOnly cookies.

### Phase 10 — Production Readiness
- Missing: deployment config, logging/observability, migrations run in CI/CD, environment-specific config validation.

---

## NEXT 5 THINGS TO BUILD

### 1. Fix the register/login write path (CRITICAL, do this first)
**What:** Rewrite `authController.js` so `register()` creates an `AuthIdentity` row (`provider: "local"`, `password_hash`) and an `OrganizationMember` row (`role: "owner"`), and `login()` looks up the password hash via the user's `AuthIdentity` instead of a non-existent `User.password_hash`.
**Why it's next:** Every other feature depends on authentication actually working; right now login is broken for all accounts.
**Depends on:** `models/User.js`, `models/AuthIdentity.js`, `models/OrganizationMember.js`, `models/index.js` (associations already defined and usable).
**Likely touched files:** `controllers/authController.js` only — no schema changes needed, the tables already support this correctly.

### 2. Wire up `requireAuth` and add a "current organization" concept to the JWT/session
**What:** Attach `authMiddleware.requireAuth` to any new protected route, and once #1 is fixed, ensure the JWT payload carries a real `organization_id`/`role` pulled from the user's (first, or selected) `OrganizationMember` row.
**Why it's next:** Nothing beyond auth can be safely built until requests can be authenticated and org-scoped.
**Depends on:** #1.
**Likely touched files:** `middleware/authMiddleware.js`, `controllers/authController.js`, a new `routes/organizationRoutes.js`.

### 3. Build Organization membership endpoints
**What:** `GET /api/organizations/:id/members`, `POST /api/organizations/:id/members` (invite), `PATCH` to change a role — all authorized against the caller's own `OrganizationMember.role`.
**Why it's next:** This is the last piece of the identity/tenancy layer before product features (Projects/Tasks) can be safely scoped per organization.
**Depends on:** #1, #2, `models/OrganizationMember.js`.
**Likely touched files:** new `controllers/organizationController.js`, new `routes/organizationRoutes.js`.

### 4. Add the `Project` model, migration, and CRUD API
**What:** A `projects` table (FK `organization_id`), optionally a `project_members` join table, plus `POST/GET/PATCH/DELETE /api/projects`.
**Why it's next:** It's the first real product feature and the parent entity for tasks.
**Depends on:** #1–#3 (needs org-scoping to know which organization a project belongs to and who may create one).
**Likely touched files:** new `models/Project.js`, new migration, new `controllers/projectController.js`, new `routes/projectRoutes.js`, frontend project pages.

### 5. Add the `Task` model, migration, and CRUD API
**What:** A `tasks` table (FK `project_id`, assignee FK `user_id`, `status`, `priority`, `due_date`), plus `POST/GET/PATCH/DELETE /api/tasks`.
**Why it's next:** This is the core value proposition of the product, and it's the natural next layer once Projects exist.
**Depends on:** #4.
**Likely touched files:** new `models/Task.js`, new migration, new `controllers/taskController.js`, new `routes/taskRoutes.js`, frontend task board/list UI (replacing the `Dashboard.jsx` placeholder).

# Flowboard UI Redesign — Zoho/Linear-style SaaS

This document explains the frontend UI redesign: what was built, why, and
how each piece is used. It covers only `Task-Manager-Frontend`. No backend,
database, or authentication logic was changed — see
[AUTHENTICATION.md](AUTHENTICATION.md) for how auth still works.

## Goal

Redesign the app to look like professional project/task-management software
(Zoho Projects / Linear / Jira inspired), replacing the previous bare-Tailwind
markup with a small set of reusable UI components and a consistent visual
language, without touching routing, auth, or backend contracts.

---

## 1. New reusable components (`src/components/ui/`)

These are the building blocks every page now uses instead of hand-rolled
markup. Kept deliberately small — only what's actually reused today or
clearly needed for the next project/task features.

| File | What it is | Used in |
|---|---|---|
| `Button.jsx` | Button with `variant` (`primary` \| `secondary` \| `ghost` \| `danger`) and `size` props. Supports `disabled` + `title` for "Coming soon" actions. | Every CTA: Invite Member, Create Project, Create Task, etc. |
| `Badge.jsx` | Small pill label. Pass `role="owner"` / `"admin"` / `"manager"` / `"member"` / `"client"` for auto-colored role badges, or `tone="success"` / `"warning"` / etc. for generic status badges. | Members table role column; will be reused for task status/priority later |
| `Avatar.jsx` | Circular avatar. Shows `avatarUrl` image if present, otherwise falls back to initials from `firstName`/`lastName` on a solid indigo background. | Members table, `UserMenu` (topbar) |
| `SearchInput.jsx` | Text input with a search icon, supports `disabled`. | Members page search box, Topbar (visual placeholder, not wired to any API) |
| `PageHeader.jsx` | Standard page header: `title`, optional `description`, optional right-aligned `actions` (buttons). | Every page (Dashboard, Members, Projects, Tasks, My Tasks, Activity, Invitations, Settings) |
| `SectionCard.jsx` | Bordered white card with optional `title`/`actions` header. Replaces repeated `rounded-xl border bg-white p-*` markup. | Dashboard sections (Quick Actions, Recent Projects, Recent Activity), Settings |

`EmptyState.jsx` (`src/components/common/EmptyState.jsx`) already existed and
was extended with an optional `action` prop (renders a `Button` inside the
empty card) rather than being replaced.

**Not built:** a generic `DataTable`. Only the Members page has a real table
today, so its table markup stays page-local — extract it into a shared
component once Projects/Tasks need tables too, to avoid designing an
abstraction against a single use case.

---

## 2. Design tokens (`tailwind.config.js`)

Added an indigo `primary` color scale (50–700) alongside the existing
`ink` / `bg` / `accent` / `status` tokens — nothing existing was removed or
renamed, so no other styling broke:

```js
primary: {
  50: "#EEF2FF", 100: "#E0E7FF", 200: "#C7D2FE", 300: "#A5B4FC",
  400: "#818CF8", 500: "#6366F1", 600: "#4F46E5", 700: "#4338CA",
}
```

`primary-600` is the main accent used for active nav items, primary buttons,
and focus rings.

---

## 3. Layout shell (`src/components/layout/`)

| File | What changed |
|---|---|
| `Sidebar.jsx` | Added a logo mark + workspace name, an indigo active-page indicator, and a desktop-only collapse toggle (icons-only mode). Mobile drawer behavior (open/close via `Topbar`'s hamburger) is unchanged. Section grouping (MAIN/WORKSPACE/TEAM/INSIGHTS/SYSTEM) still comes from `src/config/navigation.js`, which was not modified. |
| `Topbar.jsx` | Added a search input (visual only — not wired to any endpoint) and a notification bell icon (static, no backend exists for it yet). |
| `UserMenu.jsx` | Now renders the user's avatar via `Avatar.jsx` instead of inline initials markup. Logout button and `useAuth().logout()` call are unchanged. |
| `AppLayout.jsx` | Not modified — still the same `Sidebar` + `Topbar` + `<main>` shell every page wraps itself in. |

---

## 4. Pages

### Dashboard (`src/pages/Dashboard.jsx` + `src/components/dashboard/*`)
- Welcome banner now uses `PageHeader`.
- `StatCard.jsx` — restyled with the new indigo accent. Values remain
  hardcoded `"--"` placeholders — **no dashboard-statistics API was added.**
- `QuickActions.jsx` — the three action buttons are now `Button` components,
  still `disabled` with `title="Coming soon"`.
- `ProjectOverview.jsx` → **"Recent Projects"** — wrapped in `SectionCard`,
  shows a Project/Owner/Status/Progress column hint above the empty state.
- `RecentActivity.jsx` — wrapped in `SectionCard`, still an empty-state
  placeholder (no activity API exists).

### Members (`src/pages/members/Members.jsx`)
- **API call is unchanged**: still `GET /organization/members` via the
  existing `api` client, same response shape (`res.data.members`).
- Added `PageHeader` with a disabled "Invite Member" button.
- Added a search box and a role `<select>` filter. Both are **pure
  client-side filtering** over the array already returned by the fetch
  (`useMemo` + `Array.filter`) — no new network calls.
- Table rows now use `Avatar` (initials fallback) and `Badge` (role colors).
- Added a disabled "Actions" column (kebab menu icon) — visually present,
  does nothing, since no member-management endpoints exist yet.

### Placeholder pages
`Projects.jsx`, `Tasks.jsx`, `MyTasks.jsx`, `Activity.jsx`,
`Invitations.jsx`, `Settings.jsx` — each now has a `PageHeader` (title +
description + a disabled primary action where relevant) above its
`EmptyState`. `Settings.jsx` keeps its real `user` data, just wrapped in
`SectionCard`.

---

## 5. What was intentionally NOT changed

- `src/context/AuthContext.jsx` and `src/components/ProtectedRoute.jsx` —
  untouched.
- `src/api/client.js` — untouched, no new endpoints added anywhere.
- `src/App.jsx` — routes untouched.
- `Login.jsx`, `Register.jsx`, `Home.jsx`, `AuthLayout.jsx`, `FormField.jsx`
  — the dark-themed auth screens were out of scope for this redesign.
- No database or backend changes of any kind.
- No Invite Member / Create Project / Create Task functionality was
  implemented — all related buttons are present but disabled.

---

## How to try it locally

```bash
cd Task-Manager-Frontend
npm run dev
```

Then log in as usual (the real login flow is unchanged) and browse
Dashboard, Members, Projects, Tasks, My Tasks, Activity, Invitations, and
Settings to see the new layout. Resize the window to check the sidebar
collapse (desktop) and drawer (mobile) behavior.

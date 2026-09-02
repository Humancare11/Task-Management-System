// Helpers shared across the Monitoring dashboard.
// Everything here is derived from the existing `GET /monitoring/activities`
// response (activity rows with `user` + `agent` includes). No project data
// exists on monitoring records, so anything project-related is left unavailable.

export const ACTIVITY_TYPES = ["application", "website", "idle"];

export const TYPE_META = {
  application: { label: "Application", tone: "info" },
  website: { label: "Website", tone: "info" },
  idle: { label: "Idle", tone: "neutral" },
};

export function employeeName(user) {
  if (!user) return "Unknown employee";
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return name || user.email || "Unknown employee";
}

export function formatClock(value) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value) {
  if (!value) return "--";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Human-readable tracked duration. Shows real precision instead of collapsing
// everything under a minute to "<1m":
//   < 1 min   -> "45s"
//   < 1 hour  -> "12m"
//   >= 1 hour -> "1h 15m"
export function formatHm(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function formatRelative(value) {
  if (!value) return "--";
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Presence is derived purely from the timestamp of the most recent activity
// row — it is not a backend status enum. Agents only expose active/revoked.
export function deriveStatus(lastActiveAt) {
  if (!lastActiveAt) return { label: "Unavailable", tone: "neutral" };
  const diffMin = (Date.now() - new Date(lastActiveAt).getTime()) / 60000;
  if (diffMin <= 15) return { label: "Active", tone: "success" };
  if (diffMin <= 60 * 24) return { label: "Idle", tone: "warning" };
  return { label: "Offline", tone: "neutral" };
}

function isToday(value) {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// Collapse the flat activity list into one monitoring card per employee.
export function groupByEmployee(activities) {
  const map = new Map();

  activities.forEach((a) => {
    const userId = a.user?.id ?? a.user_id ?? "unknown";
    if (!map.has(userId)) {
      map.set(userId, {
        userId,
        user: a.user || null,
        devices: new Set(),
        activities: [],
        firstStartedAt: null,
        lastActiveAt: null,
        totalSeconds: 0,
        activeSeconds: 0,
        idleSeconds: 0,
        applications: 0,
        websites: 0,
        todaySeconds: 0,
      });
    }

    const group = map.get(userId);
    group.activities.push(a);
    if (a.agent?.device_name) group.devices.add(a.agent.device_name);

    const secs = Number(a.duration_seconds) || 0;
    group.totalSeconds += secs;
    if (a.activity_type === "idle") group.idleSeconds += secs;
    else group.activeSeconds += secs;
    if (a.activity_type === "application") group.applications += 1;
    if (a.activity_type === "website") group.websites += 1;
    if (isToday(a.started_at)) group.todaySeconds += secs;

    const startedTs = a.started_at ? new Date(a.started_at).getTime() : null;
    const endedTs = a.ended_at ? new Date(a.ended_at).getTime() : startedTs;
    if (startedTs && (group.firstStartedAt === null || startedTs < group.firstStartedAt)) {
      group.firstStartedAt = startedTs;
    }
    if (endedTs && (group.lastActiveAt === null || endedTs > group.lastActiveAt)) {
      group.lastActiveAt = endedTs;
    }
  });

  return Array.from(map.values())
    .map((g) => ({
      ...g,
      deviceList: Array.from(g.devices),
      status: deriveStatus(g.lastActiveAt),
      // Sort each employee's activities newest-first for the drawer.
      activities: g.activities
        .slice()
        .sort(
          (a, b) =>
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
        ),
    }))
    .sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
}

export function summarise(groups, activities) {
  const activeEmployees = groups.filter((g) => g.status.label === "Active").length;
  const todaySeconds = groups.reduce((sum, g) => sum + g.todaySeconds, 0);
  const todayActivities = activities.filter((a) => isToday(a.started_at)).length;
  return {
    activeMonitoring: activeEmployees,
    teamMembers: groups.length,
    todayActivities,
    todaySeconds,
  };
}

// Collapse one employee's raw activity rows into the breakdown the drawer
// renders: one entry per application (duration summed), each browser application
// immediately followed by a per-website entry for every domain seen under it,
// and a single "Idle" entry last. This turns dozens of individual sub-minute
// rows into:
//   Chrome      45m
//     gmail.com     18m
//     youtube.com   12m
//     github.com     5m
//   VS Code   1h 20m
//   Idle         20m
//
// Website activity is detected by the presence of `a.domain`, so it works both
// for rows the agent tags "website" and for older rows tagged "application"
// that still carry a domain.
//
// Pure and side-effect free — it does not mutate the input and is independent
// of groupByEmployee / summarise, so employee grouping, filters and the
// active/idle totals are unaffected.
export function groupByApplication(activities) {
  const apps = new Map(); // appKey -> app / idle entry
  const sitesByApp = new Map(); // appKey -> Map(domain -> website entry)

  (activities || []).forEach((a) => {
    const isIdle = a.activity_type === "idle";
    const secs = Number(a.duration_seconds) || 0;
    const label = isIdle
      ? TYPE_META.idle.label
      : a.application_name || a.domain || "Unknown";
    // Prefixed so a real application literally named "Idle" can never collide
    // with the idle bucket.
    const appKey = isIdle ? "idle:" : `app:${label}`;

    if (!apps.has(appKey)) {
      apps.set(appKey, {
        key: appKey,
        label,
        activityType: isIdle ? "idle" : "application",
        totalSeconds: 0,
        sessions: 0,
      });
    }
    const app = apps.get(appKey);
    app.totalSeconds += secs;
    app.sessions += 1;

    // Any non-idle row carrying a domain is website activity.
    if (!isIdle && a.domain) {
      if (!sitesByApp.has(appKey)) sitesByApp.set(appKey, new Map());
      const siteMap = sitesByApp.get(appKey);
      if (!siteMap.has(a.domain)) {
        siteMap.set(a.domain, {
          key: `${appKey}::site:${a.domain}`,
          label: a.domain,
          activityType: "website",
          totalSeconds: 0,
          sessions: 0,
        });
      }
      const site = siteMap.get(a.domain);
      site.totalSeconds += secs;
      site.sessions += 1;
    }
  });

  const byTimeDesc = (x, y) =>
    y.totalSeconds - x.totalSeconds || x.label.localeCompare(y.label);

  const result = [];
  Array.from(apps.values())
    .filter((e) => e.activityType !== "idle")
    .sort(byTimeDesc)
    .forEach((app) => {
      result.push(app);
      const siteMap = sitesByApp.get(app.key);
      if (siteMap) {
        Array.from(siteMap.values())
          .sort(byTimeDesc)
          .forEach((site) => result.push(site));
      }
    });

  const idle = apps.get("idle:");
  if (idle) result.push(idle);

  return result;
}

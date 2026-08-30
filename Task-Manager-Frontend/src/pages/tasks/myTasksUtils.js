// Helpers for the My Tasks personal dashboard. Everything is derived from the
// existing `GET /projects/my-tasks` response (already scoped to the logged-in
// user server-side). Task fields available: id, project_id, title, description,
// status, priority, due_date, created_at, updated_at, project{id,name}, assignee.
// There are no tags and no subtask-progress fields on this response.

export const STATUS_OPTIONS = ["todo", "in_progress", "review", "completed"];
export const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

export const STATUS_LABELS = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "In Review",
  completed: "Completed",
};

export const PRIORITY_WEIGHT = { urgent: 0, high: 1, medium: 2, low: 3 };

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 3;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Derived entirely from the real due_date + status — no hardcoded dates.
export function dueState(task) {
  if (task.status === "completed") {
    return { key: "done", label: "Completed", date: task.due_date };
  }
  if (!task.due_date) return { key: "none", label: "No due date", date: null };

  const due = new Date(task.due_date);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const today = startOfToday();
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / DAY_MS);

  if (diffDays < 0) return { key: "overdue", label: "Overdue", date: task.due_date };
  if (diffDays <= DUE_SOON_DAYS)
    return { key: "due_soon", label: "Due soon", date: task.due_date };
  return { key: "normal", label: `Due ${formatShortDate(task.due_date)}`, date: task.due_date };
}

export function projectName(task) {
  return task.project?.name ?? null;
}

export function summarise(tasks) {
  const s = {
    total: tasks.length,
    todo: 0,
    in_progress: 0,
    review: 0,
    completed: 0,
    dueSoon: 0,
    overdue: 0,
  };
  tasks.forEach((t) => {
    if (t.status in s) s[t.status] += 1;
    const d = dueState(t);
    if (d.key === "overdue") s.overdue += 1;
    if (d.key === "due_soon") s.dueSoon += 1;
  });
  return s;
}

// Ordered: overdue first, then urgent/high priority, then due-soon. Completed
// tasks never need attention. A task appears at most once.
export function needsAttention(tasks) {
  const seen = new Set();
  const out = [];
  const push = (t, reason) => {
    if (seen.has(t.id)) return;
    seen.add(t.id);
    out.push({ task: t, reason });
  };

  const open = tasks.filter((t) => t.status !== "completed");
  open
    .filter((t) => dueState(t).key === "overdue")
    .sort(byDueDate)
    .forEach((t) => push(t, "overdue"));
  open
    .filter((t) => t.priority === "urgent" || t.priority === "high")
    .sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] || byDueDate(a, b))
    .forEach((t) => push(t, "priority"));
  open
    .filter((t) => dueState(t).key === "due_soon")
    .sort(byDueDate)
    .forEach((t) => push(t, "due_soon"));

  return out;
}

export function byDueDate(a, b) {
  const av = a.due_date ? new Date(a.due_date).getTime() : Infinity;
  const bv = b.due_date ? new Date(b.due_date).getTime() : Infinity;
  return av - bv;
}

// Buckets non-completed tasks that have a due date into Today / Tomorrow /
// This Week / Later — all from real due dates.
export function groupUpcoming(tasks) {
  const today = startOfToday();
  const buckets = { today: [], tomorrow: [], week: [], later: [] };

  tasks
    .filter((t) => t.status !== "completed" && t.due_date)
    .forEach((t) => {
      const dueDay = new Date(t.due_date);
      dueDay.setHours(0, 0, 0, 0);
      const diff = Math.round((dueDay.getTime() - today.getTime()) / DAY_MS);
      if (diff < 0) return; // overdue is handled by Needs Attention
      if (diff === 0) buckets.today.push(t);
      else if (diff === 1) buckets.tomorrow.push(t);
      else if (diff <= 7) buckets.week.push(t);
      else buckets.later.push(t);
    });

  Object.values(buckets).forEach((list) => list.sort(byDueDate));
  return buckets;
}

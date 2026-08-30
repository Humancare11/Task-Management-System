import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { UserCheck, ListTree } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import TaskStatusBadge from "../../components/tasks/TaskStatusBadge.jsx";
import TaskPriorityBadge from "../../components/tasks/TaskPriorityBadge.jsx";
import MyTasksSummary from "../../components/tasks/MyTasksSummary.jsx";
import MyTasksFilters from "../../components/tasks/MyTasksFilters.jsx";
import MyTaskCard from "../../components/tasks/MyTaskCard.jsx";
import NeedsAttention from "../../components/tasks/NeedsAttention.jsx";
import UpcomingTasks from "../../components/tasks/UpcomingTasks.jsx";
import MyTasksSkeleton from "../../components/tasks/MyTasksSkeleton.jsx";
import { getMyTasks, getMySubtasks } from "../../api/tasks.js";
import {
  PRIORITY_WEIGHT,
  byDueDate,
  formatDate,
  groupUpcoming,
  needsAttention,
  summarise,
} from "./myTasksUtils.js";

const SORT_OPTIONS = [
  { key: "due_date", label: "Due date" },
  { key: "priority", label: "Priority" },
  { key: "title", label: "Title" },
];

const selectClass =
  "rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue";

function sortTasks(tasks, sortKey) {
  const list = tasks.slice();
  if (sortKey === "priority") {
    list.sort(
      (a, b) =>
        PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] || byDueDate(a, b),
    );
  } else if (sortKey === "title") {
    list.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    list.sort(byDueDate);
  }
  // Completed tasks always sink to the bottom (lower visual priority).
  list.sort((a, b) => (a.status === "completed") - (b.status === "completed"));
  return list;
}

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusTab, setStatusTab] = useState("all");
  const [sortKey, setSortKey] = useState("due_date");

  function fetchAll() {
    setLoading(true);
    setError("");
    Promise.all([getMyTasks(), getMySubtasks()])
      .then(([tasksRes, subtasksRes]) => {
        setTasks(tasksRes.data.tasks || []);
        setSubtasks(subtasksRes.data.subtasks || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Unable to load your tasks.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  // Project options are derived from the tasks actually assigned to the user.
  const projects = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (t.project?.id && !map.has(t.project.id)) {
        map.set(t.project.id, { id: t.project.id, name: t.project.name });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const summary = useMemo(() => summarise(tasks), [tasks]);
  const attention = useMemo(() => needsAttention(tasks), [tasks]);
  const upcoming = useMemo(() => groupUpcoming(tasks), [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tasks.filter((t) => {
      if (statusTab !== "all" && t.status !== statusTab) return false;
      if (projectFilter !== "all" && String(t.project?.id) !== String(projectFilter))
        return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (q) {
        const hay = `${t.title} ${t.project?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return sortTasks(list, sortKey);
  }, [tasks, search, statusTab, projectFilter, priorityFilter, sortKey]);

  const hasActiveFilter =
    search.trim() !== "" || projectFilter !== "all" || priorityFilter !== "all";

  function clearFilters() {
    setSearch("");
    setProjectFilter("all");
    setPriorityFilter("all");
  }

  const noTasksAtAll = !loading && !error && tasks.length === 0;

  return (
    <AppLayout title="My Tasks">
      <div className="space-y-6">
        <PageHeader
          title="My Tasks"
          description="Tasks assigned to you across your projects."
          actions={
            !loading &&
            !error &&
            tasks.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-txt-muted">
                Sort
                <select
                  className={selectClass}
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )
          }
        />

        {loading && <MyTasksSkeleton />}

        {!loading && error && <ErrorState message={error} onRetry={fetchAll} />}

        {noTasksAtAll && (
          <EmptyState
            icon={UserCheck}
            title="No tasks assigned"
            description="You don't have any tasks assigned to you yet."
            action={
              <Link to="/tasks">
                <Button variant="secondary">View All Tasks</Button>
              </Link>
            }
          />
        )}

        {!loading && !error && tasks.length > 0 && (
          <>
            <MyTasksSummary summary={summary} />

            <NeedsAttention items={attention} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-txt-muted">
                  My Work
                </h2>

                <MyTasksFilters
                  search={search}
                  onSearch={setSearch}
                  projects={projects}
                  projectFilter={projectFilter}
                  onProjectFilter={setProjectFilter}
                  priorityFilter={priorityFilter}
                  onPriorityFilter={setPriorityFilter}
                  statusTab={statusTab}
                  onStatusTab={setStatusTab}
                  onClear={clearFilters}
                  hasActiveFilter={hasActiveFilter}
                />

                {filtered.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-hair bg-surface-1 px-4 py-10 text-center text-sm text-txt-muted">
                    No tasks match the current filters.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((task) => (
                      <MyTaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <UpcomingTasks buckets={upcoming} />

                {subtasks.length > 0 && (
                  <section className="rounded-xl border border-hair bg-surface-1 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <ListTree size={14} className="text-txt-muted" />
                      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-txt-muted">
                        My Subtasks ({subtasks.length})
                      </h2>
                    </div>
                    <div className="space-y-2">
                      {subtasks.map((subtask) => (
                        <div key={subtask.id} className="rounded-lg bg-surface-2/60 px-3 py-2">
                          <p className="truncate text-sm font-medium text-txt-primary">
                            {subtask.title}
                          </p>
                          {subtask.task && (
                            <Link
                              to={`/projects/${subtask.task.project_id}/tasks/${subtask.task.id}`}
                              className="block truncate text-xs text-txt-muted hover:text-accentblue"
                            >
                              in {subtask.task.title}
                            </Link>
                          )}
                          <div className="mt-1 flex items-center gap-2">
                            <TaskStatusBadge status={subtask.status} />
                            <TaskPriorityBadge priority={subtask.priority} />
                            <span className="text-[11px] text-txt-muted">
                              {formatDate(subtask.due_date)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

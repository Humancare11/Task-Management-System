import { useEffect, useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import TaskRow from "../../components/tasks/TaskRow.jsx";
import { listProjects } from "../../api/projects.js";
import { listTasks } from "../../api/tasks.js";

const STATUS_OPTIONS = ["todo", "in_progress", "review", "completed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

const selectClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  function fetchAll() {
    setLoading(true);
    setError("");
    listProjects()
      .then((res) => {
        const allProjects = res.data.projects;
        setProjects(allProjects);
        return Promise.all(
          allProjects.map((project) =>
            listTasks(project.id).then((taskRes) =>
              taskRes.data.tasks.map((task) => ({ ...task, project })),
            ),
          ),
        );
      })
      .then((taskLists) => setTasks(taskLists.flat()))
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load tasks.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (projectFilter !== "all" && String(task.project_id) !== projectFilter) return false;
      if (!query) return true;
      return task.title?.toLowerCase().includes(query);
    });
  }, [tasks, search, statusFilter, priorityFilter, projectFilter]);

  return (
    <AppLayout title="Tasks">
      <div className="space-y-6">
        <PageHeader title="Tasks" description="All tasks across your organization's projects." />

        {loading && <Spinner label="Loading tasks..." />}

        {!loading && error && <ErrorState message={error} onRetry={fetchAll} />}

        {!loading && !error && tasks.length === 0 && (
          <EmptyState
            icon={ListChecks}
            title="No tasks yet."
            description="Tasks created across your organization's projects will show up here."
          />
        )}

        {!loading && !error && tasks.length > 0 && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="sm:max-w-xs"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="capitalize">
                    {opt.replace("_", " ")}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All priorities</option>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="capitalize">
                    {opt}
                  </option>
                ))}
              </select>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {filteredTasks.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No tasks match your filters."
                description="Try a different search term, status, priority, or project."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Title</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Status</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Priority</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Assignee</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Due Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTasks.map((task) => (
                        <TaskRow
                          key={`${task.project_id}-${task.id}`}
                          task={task}
                          projectId={task.project_id}
                          canEdit={false}
                          canDelete={false}
                          showProject
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

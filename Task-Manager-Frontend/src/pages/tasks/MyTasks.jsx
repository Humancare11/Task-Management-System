import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserCheck, ListTree } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import TaskRow from "../../components/tasks/TaskRow.jsx";
import TaskStatusBadge from "../../components/tasks/TaskStatusBadge.jsx";
import TaskPriorityBadge from "../../components/tasks/TaskPriorityBadge.jsx";
import { getMyTasks, getMySubtasks } from "../../api/tasks.js";

function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function fetchAll() {
    setLoading(true);
    setError("");
    Promise.all([getMyTasks(), getMySubtasks()])
      .then(([tasksRes, subtasksRes]) => {
        setTasks(tasksRes.data.tasks);
        setSubtasks(subtasksRes.data.subtasks);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load your tasks.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const isEmpty = tasks.length === 0 && subtasks.length === 0;

  return (
    <AppLayout title="My Tasks">
      <div className="space-y-6">
        <PageHeader
          title="My Tasks"
          description="Tasks and subtasks assigned to you across all projects."
        />

        {loading && <Spinner label="Loading your tasks..." />}

        {!loading && error && <ErrorState message={error} onRetry={fetchAll} />}

        {!loading && !error && isEmpty && (
          <EmptyState
            icon={UserCheck}
            title="No tasks assigned to you yet."
            description="Tasks assigned to you will appear here so you can track your work."
          />
        )}

        {!loading && !error && !isEmpty && (
          <>
            {tasks.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-6 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Tasks ({tasks.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Title
                        </th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Status
                        </th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Priority
                        </th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Assignee
                        </th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Due Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tasks.map((task) => (
                        <TaskRow
                          key={task.id}
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

            {subtasks.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-3">
                  <ListTree size={15} className="text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Subtasks ({subtasks.length})
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{subtask.title}</p>
                        {subtask.task && (
                          <Link
                            to={`/projects/${subtask.task.project_id}/tasks/${subtask.task.id}`}
                            className="mt-0.5 block text-xs text-slate-400 hover:text-primary-600"
                          >
                            Subtask of: {subtask.task.title}
                          </Link>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <TaskStatusBadge status={subtask.status} />
                        <TaskPriorityBadge priority={subtask.priority} />
                        <span className="text-sm text-slate-600">
                          {formatDate(subtask.due_date)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

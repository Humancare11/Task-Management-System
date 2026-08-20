import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  MoreVertical,
  Pencil,
  Paperclip,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";

import AppLayout from "../../components/layout/AppLayout.jsx";
import SectionCard from "../../components/ui/SectionCard.jsx";
import Button from "../../components/ui/Button.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import TaskStatusBadge from "../../components/tasks/TaskStatusBadge.jsx";
import TaskPriorityBadge from "../../components/tasks/TaskPriorityBadge.jsx";
import TaskFormModal from "../../components/tasks/TaskFormModal.jsx";

import { getTask, updateTask, deleteTask } from "../../api/tasks.js";
import { listProjectMembers } from "../../api/projectMembers.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { canEditTask, canDeleteTask } from "../../config/permissions.js";

function formatDateTime(value) {
  if (!value) return "--";

  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value) {
  if (!value) return "--";

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getUserName(person) {
  if (!person) return "--";

  return (
    `${person.first_name || ""} ${person.last_name || ""}`.trim() ||
    person.name ||
    person.email ||
    "--"
  );
}

function getStatusLabel(status) {
  const labels = {
    todo: "To Do",
    in_progress: "In Progress",
    review: "Review",
    completed: "Completed",
  };

  return labels[status] || status || "To Do";
}

function getPriorityLabel(priority) {
  if (!priority) return "Normal";

  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export default function TaskDetails() {
  const { projectId, taskId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [activeTab, setActiveTab] = useState("subtasks");

  function fetchAll() {
    setLoading(true);
    setError("");

    Promise.all([getTask(projectId, taskId), listProjectMembers(projectId)])
      .then(([taskRes, membersRes]) => {
        setTask(taskRes.data.task);
        setMembers(membersRes.data.members || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load task.");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, taskId]);

  function handleDelete() {
    setDeleting(true);

    deleteTask(projectId, taskId)
      .then(() => {
        toast.success("Task deleted.");
        navigate(`/projects/${projectId}`);
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to delete task.");
      })
      .finally(() => {
        setDeleting(false);
      });
  }

  function handleStatusChange(e) {
    const newStatus = e.target.value;

    updateTask(projectId, taskId, {
      status: newStatus,
    })
      .then(() => {
        toast.success("Task status updated.");
        fetchAll();
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message || "Failed to update task status.",
        );
      });
  }

  function handleComplete() {
    updateTask(projectId, taskId, {
      status: "completed",
    })
      .then(() => {
        toast.success("Task marked as completed.");
        fetchAll();
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to complete task.");
      });
  }

  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : [];

  const attachments = Array.isArray(task?.attachments) ? task.attachments : [];

  const tags = Array.isArray(task?.tags) ? task.tags : [];

  const comments = Array.isArray(task?.comments) ? task.comments : [];

  const activity = Array.isArray(task?.activity) ? task.activity : [];

  const completedSubtasks = useMemo(() => {
    return subtasks.filter(
      (item) => item.completed === true || item.status === "completed",
    ).length;
  }, [subtasks]);

  const calculatedProgress =
    subtasks.length > 0
      ? Math.round((completedSubtasks / subtasks.length) * 100)
      : typeof task?.progress === "number"
        ? task.progress
        : null;

  const isAssignedUser =
    user?.id === task?.assigned_to &&
    ["member", "manager"].includes(user?.role);

  if (loading) {
    return (
      <AppLayout title="Task Details">
        <Spinner label="Loading task..." />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Task Details">
        <ErrorState message={error} onRetry={fetchAll} />
      </AppLayout>
    );
  }

  if (!task) return null;

  return (
    <AppLayout title="Task Details">
      <div className="min-h-full bg-slate-50">
        <div className="space-y-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <Link
              to={`/projects/${projectId}`}
              className="inline-flex items-center gap-2 text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft size={15} />
              Tasks
            </Link>

            <span className="text-slate-300">›</span>

            <span className="text-slate-700">Task Details</span>
          </div>

          {/* Main Layout */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            {/* LEFT */}
            <div className="space-y-4">
              {/* Task Main Card */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Header */}
                <div className="border-b border-slate-200 px-5 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-3">
                        {isAssignedUser ? (
                          <select
                            value={task.status}
                            onChange={handleStatusChange}
                            className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-600 outline-none focus:border-sky-400"
                          >
                            <option value="todo">To Do</option>

                            <option value="in_progress">In Progress</option>

                            <option value="review">Review</option>

                            <option value="completed">Completed</option>
                          </select>
                        ) : (
                          <TaskStatusBadge status={task.status} />
                        )}
                      </div>

                      <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                        {task.title}
                      </h1>

                      <div className="mt-1 text-sm text-slate-500">
                        {task.project?.name || task.project_name || "Project"} ·
                        Created {formatDate(task.created_at)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      {canEditTask(user) && (
                        <button
                          type="button"
                          onClick={() => setEditOpen(true)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          title="Edit task"
                        >
                          <Pencil size={17} />
                        </button>
                      )}

                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                        title="Share task"
                      >
                        <Share2 size={17} />
                      </button>

                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                        title="More options"
                      >
                        <MoreVertical size={17} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Attachments */}
                {attachments.length > 0 && (
                  <div className="px-5 py-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-900">
                        Attachment ({attachments.length})
                      </h2>

                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
                      >
                        <Download size={13} />
                        Download All
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {attachments.map((file, index) => (
                        <div
                          key={file.id || index}
                          className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                              <Paperclip size={17} className="text-slate-500" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {file.name || file.file_name || "Attachment"}
                              </p>

                              {file.size && (
                                <p className="text-xs text-slate-400">
                                  {file.size}
                                </p>
                              )}
                            </div>
                          </div>

                          {file.url && (
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Download size={15} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload/attachment placeholder only when API supports it */}
                {attachments.length === 0 && (
                  <div className="px-5 py-4">
                    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center">
                      <Paperclip
                        size={18}
                        className="mx-auto mb-1 text-slate-300"
                      />

                      <p className="text-xs text-slate-400">No attachments</p>
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="border-t border-slate-200 px-5 py-5">
                  <h2 className="mb-2 text-sm font-semibold text-slate-900">
                    Description
                  </h2>

                  <p className="whitespace-pre-line text-sm leading-6 text-slate-600">
                    {task.description || "No description provided."}
                  </p>
                </div>
              </div>

              {/* Subtasks / Comments / Activity */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Tabs */}
                <div className="border-b border-slate-200 px-5 pt-4">
                  <div className="flex items-center gap-6">
                    {[
                      ["subtasks", "Subtasks"],
                      ["comments", "Comments"],
                      ["activity", "Activity"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTab(key)}
                        className={`relative pb-3 text-sm font-medium transition ${
                          activeTab === key
                            ? "text-sky-600"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {label}

                        {key === "subtasks" && subtasks.length > 0 && (
                          <span className="ml-1.5 text-xs text-slate-400">
                            ({subtasks.length})
                          </span>
                        )}

                        {activeTab === key && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-sky-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtasks */}
                {activeTab === "subtasks" && (
                  <div className="px-5 py-5">
                    {subtasks.length > 0 ? (
                      <>
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-900">
                            Task Subtasks
                          </h3>

                          <span className="text-xs text-slate-500">
                            {completedSubtasks} / {subtasks.length} completed
                          </span>
                        </div>

                        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-sky-500 transition-all"
                            style={{
                              width: `${calculatedProgress}%`,
                            }}
                          />
                        </div>

                        <div className="space-y-3">
                          {subtasks.map((subtask, index) => {
                            const completed =
                              subtask.completed === true ||
                              subtask.status === "completed";

                            return (
                              <div
                                key={subtask.id || index}
                                className="flex items-center gap-3"
                              >
                                <div
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    completed
                                      ? "border-sky-500 bg-sky-500"
                                      : "border-slate-300 bg-white"
                                  }`}
                                >
                                  {completed && (
                                    <CheckCircle2
                                      size={12}
                                      className="text-white"
                                    />
                                  )}
                                </div>

                                <span
                                  className={`text-sm ${
                                    completed
                                      ? "text-slate-400 line-through"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {subtask.title ||
                                    subtask.name ||
                                    `Subtask ${index + 1}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="py-6 text-center">
                        <p className="text-sm text-slate-400">
                          No subtasks available.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Comments */}
                {activeTab === "comments" && (
                  <div className="px-5 py-6">
                    {comments.length > 0 ? (
                      <div className="space-y-4">
                        {comments.map((comment, index) => (
                          <div
                            key={comment.id || index}
                            className="rounded-xl bg-slate-50 p-4"
                          >
                            <p className="text-sm text-slate-700">
                              {comment.text ||
                                comment.comment ||
                                comment.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-sm text-slate-400">
                        No comments yet.
                      </p>
                    )}
                  </div>
                )}

                {/* Activity */}
                {activeTab === "activity" && (
                  <div className="px-5 py-6">
                    {activity.length > 0 ? (
                      <div className="space-y-4">
                        {activity.map((item, index) => (
                          <div key={item.id || index} className="flex gap-3">
                            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" />

                            <div>
                              <p className="text-sm text-slate-700">
                                {item.message ||
                                  item.description ||
                                  "Task activity"}
                              </p>

                              {item.created_at && (
                                <p className="mt-1 text-xs text-slate-400">
                                  {formatDateTime(item.created_at)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-sm text-slate-400">
                        No activity available.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT DETAILS */}
            <div>
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="px-5 py-5">
                  <h2 className="mb-5 text-sm font-semibold text-slate-900">
                    Details
                  </h2>

                  <div className="space-y-5">
                    {/* Status */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-500">Status</span>

                      <TaskStatusBadge status={task.status} />
                    </div>

                    {/* Priority */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-500">Priority</span>

                      <TaskPriorityBadge priority={task.priority} />
                    </div>

                    {/* Assignee */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-500">Assignee</span>

                      <div className="flex items-center gap-2">
                        {task.assignee ? (
                          <>
                            <Avatar
                              firstName={task.assignee.first_name}
                              lastName={task.assignee.last_name}
                              avatarUrl={task.assignee.avatar_url}
                              size="sm"
                            />

                            <span className="max-w-[150px] truncate text-sm font-medium text-slate-700">
                              {getUserName(task.assignee)}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-slate-400">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Start Date */}
                    {task.start_date && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-slate-500">
                          Start Date
                        </span>

                        <span className="text-sm font-medium text-slate-700">
                          {formatDate(task.start_date)}
                        </span>
                      </div>
                    )}

                    {/* Due Date */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-500">Due Date</span>

                      <span className="text-sm font-medium text-slate-700">
                        {formatDate(task.due_date)}
                      </span>
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="flex items-start justify-between gap-4">
                        <span className="pt-1 text-sm text-slate-500">
                          Tags
                        </span>

                        <div className="flex max-w-[200px] flex-wrap justify-end gap-1.5">
                          {tags.map((tag, index) => (
                            <span
                              key={tag.id || index}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                            >
                              {typeof tag === "string" ? tag : tag.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress */}
                {calculatedProgress !== null && (
                  <div className="border-t border-slate-200 px-5 py-5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-slate-500">
                        Overall progress
                      </span>

                      <span className="text-sm font-semibold text-slate-700">
                        {calculatedProgress}%
                      </span>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all"
                        style={{
                          width: `${calculatedProgress}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Complete */}
                {task.status !== "completed" && (
                  <div className="px-5 pb-5">
                    <button
                      type="button"
                      onClick={handleComplete}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600"
                    >
                      <CheckCircle2 size={16} />
                      Mark Complete
                    </button>
                  </div>
                )}

                {canDeleteTask(user) && (
                  <div className="border-t border-slate-100 px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setDeleteOpen(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                      Delete Task
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <TaskFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        projectId={projectId}
        mode="edit"
        task={task}
        projectMembers={members}
        onSaved={() => {
          setEditOpen(false);
          fetchAll();
        }}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Task"
        description={`Delete "${task.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </AppLayout>
  );
}

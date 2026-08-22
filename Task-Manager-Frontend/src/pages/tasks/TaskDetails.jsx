import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  MoreVertical,
  Pencil,
  Paperclip,
  Plus,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";

import AppLayout from "../../components/layout/AppLayout.jsx";
import Button from "../../components/ui/Button.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import TaskStatusBadge from "../../components/tasks/TaskStatusBadge.jsx";
import TaskPriorityBadge from "../../components/tasks/TaskPriorityBadge.jsx";
import TaskFormModal from "../../components/tasks/TaskFormModal.jsx";
import SubtaskFormModal from "../../components/subtasks/SubtaskFormModal.jsx";
import SubtaskDetailPanel from "../../components/subtasks/SubtaskDetailPanel.jsx";
import { getTask, updateTask, deleteTask } from "../../api/tasks.js";
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
} from "../../api/attachments.js";

import {
  listComments,
  createComment,
  deleteComment,
} from "../../api/comments.js";
import {
  listSubtasks,
  updateSubtask,
  deleteSubtask,
} from "../../api/subtasks.js";
import { listProjectMembers } from "../../api/projectMembers.js";
import { getSocket } from "../../lib/socket.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import {
  canEditTask,
  canDeleteTask,
  canEditSubtaskFully,
  canUpdateSubtaskStatus,
  canDeleteComment,
} from "../../config/permissions.js";
import { API_ORIGIN } from "../../api/client.js";

// ─── helpers ────────────────────────────────────────────────────────────────

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

/** Cycle: todo → in_progress → completed → todo */
function nextStatus(current) {
  if (current === "todo") return "in_progress";
  if (current === "in_progress") return "completed";
  return "todo";
}

const STATUS_CYCLE_LABEL = {
  todo: "Mark in progress",
  in_progress: "Mark completed",
  completed: "Reset to to-do",
};

// ─── component ──────────────────────────────────────────────────────────────

export default function TaskDetails() {
  const { projectId, taskId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // ── task state ──
  const [task, setTask] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── task modal/dialog state ──
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── subtask modal/dialog state ──
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState(null);

  // ── tabs ──
  const [activeTab, setActiveTab] = useState("subtasks");

  // ── subtask state ──
  const [subtasks, setSubtasks] = useState([]);
  const [subtaskUpdating, setSubtaskUpdating] = useState({}); // { [id]: true }
  const [subtaskDeleting, setSubtaskDeleting] = useState({}); // { [id]: true }
  const [subtaskToDelete, setSubtaskToDelete] = useState(null); // subtask object
  const [expandedSubtaskId, setExpandedSubtaskId] = useState(null);

  // ── attachment state ──
  const [attachments, setAttachments] = useState([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState(null);
  const [attachmentDeleting, setAttachmentDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // ── comment state ──
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [commentDeleting, setCommentDeleting] = useState(false);

  // ─── data loading ────────────────────────────────────────────────────────

  function fetchAll() {
    setLoading(true);
    setError("");

    Promise.all([
      getTask(projectId, taskId),
      listProjectMembers(projectId),
      listSubtasks(projectId, taskId),
      listComments(projectId, taskId),
      listAttachments(projectId, taskId),
    ])
      .then(
        ([taskRes, membersRes, subtasksRes, commentsRes, attachmentsRes]) => {
          setTask(taskRes.data.task);
          setMembers(membersRes.data.members);
          setSubtasks(subtasksRes.data.subtasks);
          setComments(commentsRes.data.comments);
          setAttachments(attachmentsRes.data.attachments);
        },
      )
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load task details.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, taskId]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("task:join", taskId);

    function handleSubtaskCreated(subtask) {
      setSubtasks((prev) =>
        prev.some((s) => s.id === subtask.id) ? prev : [...prev, subtask],
      );
    }
    function handleSubtaskUpdated(subtask) {
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtask.id ? subtask : s)),
      );
    }
    function handleSubtaskDeleted({ subtaskId }) {
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    }

    function handleCommentCreated(comment) {
      setComments((prev) =>
        prev.some((c) => c.id === comment.id) ? prev : [...prev, comment],
      );
    }
    function handleCommentDeleted({ commentId }) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }

    socket.on("subtask:created", handleSubtaskCreated);
    socket.on("subtask:updated", handleSubtaskUpdated);
    socket.on("subtask:deleted", handleSubtaskDeleted);
    socket.on("comment:created", handleCommentCreated);
    socket.on("comment:deleted", handleCommentDeleted);

    return () => {
      socket.emit("task:leave", taskId);
      socket.off("subtask:created", handleSubtaskCreated);
      socket.off("subtask:updated", handleSubtaskUpdated);
      socket.off("subtask:deleted", handleSubtaskDeleted);
      socket.off("comment:created", handleCommentCreated);
      socket.off("comment:deleted", handleCommentDeleted);
    };
  }, [taskId]);

  // ─── task actions ─────────────────────────────────────────────────────────

  function handleDelete() {
    setDeleting(true);
    deleteTask(projectId, taskId)
      .then(() => {
        toast.success("Task deleted.");
        navigate(`/projects/${projectId}`);
      })
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to delete task."),
      )
      .finally(() => setDeleting(false));
  }

  function handleStatusChange(e) {
    updateTask(projectId, taskId, { status: e.target.value })
      .then(() => {
        toast.success("Task status updated.");
        fetchAll();
      })
      .catch((err) =>
        toast.error(
          err.response?.data?.message || "Failed to update task status.",
        ),
      );
  }

  function handleComplete() {
    updateTask(projectId, taskId, { status: "completed" })
      .then(() => {
        toast.success("Task marked as completed.");
        fetchAll();
      })
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to complete task."),
      );
  }

  // ─── subtask actions ──────────────────────────────────────────────────────

  /** Cycle a subtask's status optimistically */
  function handleSubtaskStatusToggle(subtask) {
    if (subtaskUpdating[subtask.id]) return;

    // Members can only toggle subtasks assigned to them
    if (user?.role === "member" && subtask.assigned_to !== user?.id) {
      toast.error("You can only update subtasks assigned to you.");
      return;
    }

    const next = nextStatus(subtask.status);
    const previous = subtask.status;

    // optimistic update
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtask.id ? { ...s, status: next } : s)),
    );
    setSubtaskUpdating((prev) => ({ ...prev, [subtask.id]: true }));

    updateSubtask(projectId, taskId, subtask.id, { status: next })
      .then((res) => {
        // Sync with server response (server is source of truth)
        setSubtasks((prev) =>
          prev.map((s) =>
            s.id === subtask.id ? { ...s, ...res.data.subtask } : s,
          ),
        );
      })
      .catch((err) => {
        // Roll back
        setSubtasks((prev) =>
          prev.map((s) =>
            s.id === subtask.id ? { ...s, status: previous } : s,
          ),
        );
        toast.error(
          err.response?.data?.message || "Failed to update subtask status.",
        );
      })
      .finally(() =>
        setSubtaskUpdating((prev) => ({ ...prev, [subtask.id]: false })),
      );
  }

  /** Confirm-delete a subtask */
  function handleSubtaskDeleteConfirm() {
    if (!subtaskToDelete) return;

    const id = subtaskToDelete.id;
    setSubtaskDeleting((prev) => ({ ...prev, [id]: true }));

    deleteSubtask(projectId, taskId, id)
      .then(() => {
        setSubtasks((prev) => prev.filter((s) => s.id !== id));
        toast.success("Subtask deleted.");
      })
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to delete subtask."),
      )
      .finally(() => {
        setSubtaskDeleting((prev) => ({ ...prev, [id]: false }));
        setSubtaskToDelete(null);
      });
  }

  // ─── attachment actions ───────────────────────────────────────────────────

  function handleFileUpload(file) {
    if (!file) return;
    setAttachmentUploading(true);
    uploadAttachment(projectId, taskId, file)
      .then((res) => {
        setAttachments((prev) => [...prev, res.data.attachment]);
        toast.success("File uploaded.");
      })
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to upload file."),
      )
      .finally(() => setAttachmentUploading(false));
  }

  function handleFileInputChange(e) {
    handleFileUpload(e.target.files[0]);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files[0]);
  }

  function handleAttachmentDeleteConfirm() {
    if (!attachmentToDelete) return;
    setAttachmentDeleting(true);
    deleteAttachment(projectId, taskId, attachmentToDelete.id)
      .then(() => {
        setAttachments((prev) =>
          prev.filter((a) => a.id !== attachmentToDelete.id),
        );
        toast.success("Attachment deleted.");
      })
      .catch((err) =>
        toast.error(
          err.response?.data?.message || "Failed to delete attachment.",
        ),
      )
      .finally(() => {
        setAttachmentDeleting(false);
        setAttachmentToDelete(null);
      });
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ─── comment actions ──────────────────────────────────────────────────────

  function handleSendComment() {
    const content = commentText.trim();
    if (!content) return;

    setCommentSending(true);

    createComment(projectId, taskId, content)
      .then((res) => {
        setComments((prev) =>
          prev.some((c) => c.id === res.data.comment.id)
            ? prev
            : [...prev, res.data.comment],
        );
        setCommentText("");
      })
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to send comment."),
      )
      .finally(() => setCommentSending(false));
  }

  function handleCommentKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  }

  function handleCommentDeleteConfirm() {
    if (!commentToDelete) return;

    setCommentDeleting(true);

    deleteComment(projectId, taskId, commentToDelete.id)
      .then(() => {
        setComments((prev) => prev.filter((c) => c.id !== commentToDelete.id));
        toast.success("Comment deleted.");
      })
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to delete comment."),
      )
      .finally(() => {
        setCommentDeleting(false);
        setCommentToDelete(null);
      });
  }

  function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // ─── derived values ───────────────────────────────────────────────────────

  const tags = Array.isArray(task?.tags) ? task.tags : [];
  const activity = Array.isArray(task?.activity) ? task.activity : [];

  const completedSubtasks = useMemo(
    () => subtasks.filter((s) => s.status === "completed").length,
    [subtasks],
  );

  const calculatedProgress =
    subtasks.length > 0
      ? Math.round((completedSubtasks / subtasks.length) * 100)
      : typeof task?.progress === "number"
        ? task.progress
        : null;

  const isAssignedUser =
    user?.id === task?.assigned_to &&
    ["member", "manager"].includes(user?.role);

  const canManage = canEditSubtaskFully(user);

  // ─── render ───────────────────────────────────────────────────────────────

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
            {/* ── LEFT ── */}
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
                <div className="px-5 py-5">
                  {/* Header */}
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Attachments
                      {attachments.length > 0 && (
                        <span className="ml-1.5 text-slate-400">
                          ({attachments.length})
                        </span>
                      )}
                    </h2>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={attachmentUploading}
                        className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 disabled:opacity-40"
                      >
                        <Upload size={13} />
                        {attachmentUploading ? "Uploading…" : "Upload"}
                      </button>
                    )}
                  </div>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileInputChange}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />

                  {/* File list */}
                  {attachments.length > 0 && (
                    <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {attachments.map((file) => (
                        <div
                          key={file.id}
                          className="group flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                              <Paperclip size={17} className="text-slate-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {file.file_name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {formatFileSize(file.file_size)}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <a
                              href={`${API_ORIGIN}${file.url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Download"
                            >
                              <Download size={15} />
                            </a>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => setAttachmentToDelete(file)}
                                className="hidden rounded-md p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 group-hover:block"
                                title="Delete"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Drag & drop zone */}
                  {canManage && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${dragOver
                          ? "border-sky-400 bg-sky-50"
                          : "border-slate-200 hover:border-slate-300"
                        }`}
                    >
                      <Upload
                        size={18}
                        className={`mx-auto mb-1 ${dragOver ? "text-sky-400" : "text-slate-300"}`}
                      />
                      <p className="text-xs text-slate-400">
                        {attachmentUploading
                          ? "Uploading…"
                          : "Drop a file here or click to upload"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-300">
                        PNG, JPG, PDF, DOC, XLS up to 10MB
                      </p>
                    </div>
                  )}

                  {/* Empty state for non-managers */}
                  {!canManage && attachments.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-center">
                      <Paperclip
                        size={18}
                        className="mx-auto mb-1 text-slate-300"
                      />
                      <p className="text-xs text-slate-400">No attachments</p>
                    </div>
                  )}
                </div>

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

              {/* ── Subtasks / Comments / Activity card ── */}
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
                        className={`relative pb-3 text-sm font-medium transition ${activeTab === key
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

                {/* ── SUBTASKS TAB ── */}
                {activeTab === "subtasks" && (
                  <div className="px-5 py-5">
                    {subtasks.length > 0 && (
                      <>
                        {/* Header row */}
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">
                              Task Subtasks
                            </h3>

                            <span className="text-xs text-slate-500">
                              {completedSubtasks} / {subtasks.length} completed
                            </span>
                          </div>

                          {["owner", "admin", "manager", "member"].includes(
                            user?.role,
                          ) && (
                            <Button
                              onClick={() => {
                                setEditingSubtask(null);
                                setSubtaskModalOpen(true);
                              }}
                            >
                              + Add Subtask
                            </Button>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-sky-500 transition-all duration-300"
                            style={{ width: `${calculatedProgress}%` }}
                          />
                        </div>
                      </>
                    )}

                    {/* Subtask list */}
                    {subtasks.length === 0 && (
                      <div className="py-6 text-center">
                        <p className="text-sm text-slate-400">
                          No subtasks yet.
                        </p>
                      </div>
                    )}

                    {subtasks.length > 0 && (
                      <div className="space-y-2">
                        {subtasks.map((subtask) => {
                          const completed = subtask.status === "completed";
                          const isUpdating = !!subtaskUpdating[subtask.id];
                          const isDeleting = !!subtaskDeleting[subtask.id];

                          // Only assigned member or managers can toggle status
                          const canToggle = canUpdateSubtaskStatus(user, subtask);

                          // Warn owner if task is due within 2 days and subtask is incomplete
                          const isDueSoon =
                            !completed &&
                            task?.due_date &&
                            (() => {
                              const diff = new Date(task.due_date) - new Date();
                              return diff > 0 && diff < 2 * 24 * 60 * 60 * 1000;
                            })();

                          const isExpanded = expandedSubtaskId === subtask.id;

                          return (
                            <div key={subtask.id}>
                            <div
                              className={`group flex items-center justify-between gap-3 rounded-lg border px-3 py-3 transition ${
                                isUpdating || isDeleting
                                  ? "border-slate-100 opacity-60"
                                  : isDueSoon
                                    ? "border-amber-200 bg-amber-50"
                                    : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                              {/* Left: checkbox + text */}
                              <button
                                type="button"
                                disabled={
                                  isUpdating || isDeleting || !canToggle
                                }
                                onClick={() =>
                                  handleSubtaskStatusToggle(subtask)
                                }
                                title={
                                  canToggle
                                    ? STATUS_CYCLE_LABEL[subtask.status]
                                    : "Not assigned to you"
                                }
                                className={`flex min-w-0 flex-1 items-center gap-3 text-left ${!canToggle ? "cursor-default" : ""
                                  }`}
                              >
                                {/* Checkbox */}
                                <div
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${completed
                                      ? "border-sky-500 bg-sky-500"
                                      : subtask.status === "in_progress"
                                        ? "border-blue-400 bg-blue-50"
                                        : "border-slate-300 bg-white"
                                    }`}
                                >
                                  {completed && (
                                    <CheckCircle2
                                      size={12}
                                      className="text-white"
                                    />
                                  )}
                                  {subtask.status === "in_progress" && (
                                    <div className="h-2 w-2 rounded-full bg-blue-400" />
                                  )}
                                </div>

                                {/* Title + description */}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p
                                      className={`text-sm ${completed
                                          ? "text-slate-400 line-through"
                                          : "text-slate-700"
                                        }`}
                                    >
                                      {subtask.title}
                                    </p>
                                    {/* Due-soon pill — visible to everyone */}
                                    {isDueSoon && (
                                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-600">
                                        Due soon
                                      </span>
                                    )}
                                  </div>
                                  {subtask.description && (
                                    <p className="mt-0.5 truncate text-xs text-slate-400">
                                      {subtask.description}
                                    </p>
                                  )}
                                  {Array.isArray(subtask.tags) &&
                                    subtask.tags.length > 0 && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {subtask.tags.map((tag) => (
                                          <span
                                            key={tag.id}
                                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                                          >
                                            {tag.name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                </div>
                              </button>

                              {/* Right: assignee avatar + status badge + delete */}
                              <div className="flex shrink-0 items-center gap-2">
                                {/* Assignee avatar — owners/admins/managers see who owns this */}
                                {canManage && subtask.assignee && (
                                  <div title={getUserName(subtask.assignee)}>
                                    <Avatar
                                      firstName={subtask.assignee.first_name}
                                      lastName={subtask.assignee.last_name}
                                      avatarUrl={subtask.assignee.avatar_url}
                                      size="xs"
                                    />
                                  </div>
                                )}

                                {/* Unassigned warning — nudges owner to assign someone */}
                                {canManage && !subtask.assignee && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                                    Unassigned
                                  </span>
                                )}

                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-medium ${completed
                                      ? "bg-green-50 text-green-600"
                                      : subtask.status === "in_progress"
                                        ? "bg-blue-50 text-blue-600"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                >
                                  {completed
                                    ? "Completed"
                                    : subtask.status === "in_progress"
                                      ? "In Progress"
                                      : "To Do"}
                                </span>

                                {/* Delete — management roles only */}
                                {canManage && (
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => setSubtaskToDelete(subtask)}
                                    className="hidden rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500 group-hover:flex"
                                    title="Delete subtask"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}

                                {/* Expand/collapse — comments & attachments */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedSubtaskId((prev) =>
                                      prev === subtask.id ? null : subtask.id,
                                    )
                                  }
                                  className="rounded p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
                                  title={
                                    isExpanded
                                      ? "Hide comments & attachments"
                                      : "Show comments & attachments"
                                  }
                                >
                                  {isExpanded ? (
                                    <ChevronDown size={14} />
                                  ) : (
                                    <ChevronRight size={14} />
                                  )}
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="mt-1.5">
                                <SubtaskDetailPanel
                                  projectId={projectId}
                                  taskId={taskId}
                                  subtask={subtask}
                                />
                              </div>
                            )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add button — management roles only */}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubtask(null);
                          setSubtaskModalOpen(true);
                        }}
                        className="mt-3 flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
                      >
                        <Plus size={14} />
                        Add subtask
                      </button>
                    )}
                  </div>
                )}

                {/* Comments tab */}
                {activeTab === "comments" && (
                  <div className="flex flex-col">
                    {/* Comment list */}
                    <div className="space-y-5 px-5 py-5">
                      {comments.length === 0 && (
                        <p className="text-center text-sm text-slate-400">
                          No comments yet. Be the first to comment.
                        </p>
                      )}

                      {comments.map((comment) => {
                        const canDelete = canDeleteComment(user, comment);

                        return (
                          <div key={comment.id} className="group flex gap-3">
                            {/* Avatar */}
                            <div className="shrink-0">
                              <Avatar
                                firstName={comment.author?.first_name}
                                lastName={comment.author?.last_name}
                                avatarUrl={comment.author?.avatar_url}
                                size="sm"
                              />
                            </div>

                            {/* Body */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-800">
                                  {getUserName(comment.author)}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {timeAgo(comment.created_at)}
                                </span>

                                {/* Delete button */}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => setCommentToDelete(comment)}
                                    className="ml-auto hidden rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500 group-hover:block"
                                    title="Delete comment"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>

                              <p className="mt-0.5 text-sm leading-6 text-slate-600">
                                {comment.content}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Composer */}
                    <div className="border-t border-slate-100 px-5 py-4">
                      <div className="flex gap-3">
                        {/* Current user avatar */}
                        <div className="shrink-0">
                          <Avatar
                            firstName={user?.first_name}
                            lastName={user?.last_name}
                            avatarUrl={user?.avatar_url}
                            size="sm"
                          />
                        </div>

                        <div className="flex-1 rounded-xl border border-slate-200 bg-white transition focus-within:border-sky-300 focus-within:ring-1 focus-within:ring-sky-100">
                          <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={handleCommentKeyDown}
                            placeholder="Write a comment…"
                            disabled={commentSending}
                            rows={2}
                            className="w-full resize-none rounded-t-xl px-3 pt-3 text-sm text-slate-700 placeholder-slate-400 outline-none"
                          />

                          {/* Toolbar */}
                          <div className="flex items-center justify-between px-3 pb-2 pt-1">
                            <div className="flex items-center gap-3 text-slate-400">
                              <button
                                type="button"
                                className="transition hover:text-slate-600"
                                title="Attach file (coming soon)"
                              >
                                <Paperclip size={15} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={handleSendComment}
                              disabled={!commentText.trim() || commentSending}
                              className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-600 disabled:opacity-40"
                            >
                              {commentSending ? "Sending…" : "Send"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Activity tab */}
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

            {/* ── RIGHT DETAILS ── */}
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

                {/* Overall progress */}
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
                        className="h-full rounded-full bg-sky-500 transition-all duration-300"
                        style={{ width: `${calculatedProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Mark complete */}
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

                {/* Delete task */}
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

      {/* Edit Task Modal */}
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

      {/* Delete Attachment Dialog */}
      <ConfirmDialog
        open={!!attachmentToDelete}
        onClose={() => setAttachmentToDelete(null)}
        onConfirm={handleAttachmentDeleteConfirm}
        title="Delete Attachment"
        description={`Delete "${attachmentToDelete?.file_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={attachmentDeleting}
      />

      {/* Delete Comment Dialog */}
      <ConfirmDialog
        open={!!commentToDelete}
        onClose={() => setCommentToDelete(null)}
        onConfirm={handleCommentDeleteConfirm}
        title="Delete Comment"
        description="Delete this comment? This cannot be undone."
        confirmLabel="Delete"
        loading={commentDeleting}
      />

      {/* Delete Task Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Task"
        description={`Delete "${task.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />

      {/* Delete Subtask Dialog */}
      <ConfirmDialog
        open={!!subtaskToDelete}
        onClose={() => setSubtaskToDelete(null)}
        onConfirm={handleSubtaskDeleteConfirm}
        title="Delete Subtask"
        description={`Delete "${subtaskToDelete?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={!!subtaskDeleting[subtaskToDelete?.id]}
      />

      <SubtaskFormModal
        open={subtaskModalOpen}
        onClose={() => {
          setSubtaskModalOpen(false);
          setEditingSubtask(null);
        }}
        projectId={projectId}
        taskId={taskId}
        mode={editingSubtask ? "edit" : "create"}
        subtask={editingSubtask}
        projectMembers={members}
        onSaved={fetchAll}
      />
    </AppLayout>
  );
}

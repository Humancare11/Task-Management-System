import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import SectionCard from "../../components/ui/SectionCard.jsx";
import Button from "../../components/ui/Button.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import TaskStatusBadge from "../../components/tasks/TaskStatusBadge.jsx";
import TaskPriorityBadge from "../../components/tasks/TaskPriorityBadge.jsx";
import TaskFormModal from "../../components/tasks/TaskFormModal.jsx";
import { getTask, deleteTask } from "../../api/tasks.js";
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

  function fetchAll() {
    setLoading(true);
    setError("");
    Promise.all([getTask(projectId, taskId), listProjectMembers(projectId)])
      .then(([taskRes, membersRes]) => {
        setTask(taskRes.data.task);
        setMembers(membersRes.data.members);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load task.");
      })
      .finally(() => setLoading(false));
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
      .finally(() => setDeleting(false));
  }

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

  return (
    <AppLayout title={task.title}>
      <div className="space-y-6">
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink"
        >
          <ArrowLeft size={15} /> Back to Project
        </Link>

        <PageHeader
          title={task.title}
          description={task.description || "No description provided."}
          actions={
            <>
              {canEditTask(user) && (
                <Button variant="secondary" icon={Pencil} onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
              )}
              {canDeleteTask(user) && (
                <Button variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
              )}
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SectionCard title="Details">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Assignee</dt>
                <dd>
                  {task.assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar
                        firstName={task.assignee.first_name}
                        lastName={task.assignee.last_name}
                        avatarUrl={task.assignee.avatar_url}
                        size="sm"
                      />
                      <span className="text-ink">
                        {task.assignee.first_name} {task.assignee.last_name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Due Date</dt>
                <dd className="text-ink">{formatDateTime(task.due_date)}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Activity">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Created By</dt>
                <dd className="text-ink">
                  {task.creator ? `${task.creator.first_name} ${task.creator.last_name}` : "--"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Created</dt>
                <dd className="text-ink">{formatDateTime(task.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Updated</dt>
                <dd className="text-ink">{formatDateTime(task.updated_at)}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>

      <TaskFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        projectId={projectId}
        mode="edit"
        task={task}
        projectMembers={members}
        onSaved={fetchAll}
      />

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

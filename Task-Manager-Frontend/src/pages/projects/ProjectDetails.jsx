import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, ListChecks, ListPlus, Pencil, Trash2 } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import SectionCard from "../../components/ui/SectionCard.jsx";
import Button from "../../components/ui/Button.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import ProjectStatusBadge from "../../components/projects/ProjectStatusBadge.jsx";
import ProjectPriorityBadge from "../../components/projects/ProjectPriorityBadge.jsx";
import ProjectMembersTab from "../../components/projects/ProjectMembersTab.jsx";
import TaskRow from "../../components/tasks/TaskRow.jsx";
import TaskFormModal from "../../components/tasks/TaskFormModal.jsx";
import { getProject, deleteProject } from "../../api/projects.js";
import { listTasks, deleteTask } from "../../api/tasks.js";
import { listProjectMembers } from "../../api/projectMembers.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import {
  canEditProject,
  canDeleteProject,
  canManageProjectMembers,
  canCreateTask,
  canEditTask,
  canDeleteTask,
} from "../../config/permissions.js";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "tasks", label: "Tasks" },
  { key: "members", label: "Members" },
];

const TASK_STATUS_OPTIONS = ["todo", "in_progress", "review", "completed"];
const TASK_PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

const selectClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";

function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ProjectDetails() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("all");

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState("create");
  const [editingTask, setEditingTask] = useState(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState(null);
  const [deletingTask, setDeletingTask] = useState(false);

  function fetchAll() {
    setLoading(true);
    setError("");
    Promise.all([getProject(projectId), listTasks(projectId), listProjectMembers(projectId)])
      .then(([projectRes, tasksRes, membersRes]) => {
        setProject(projectRes.data.project);
        setTasks(tasksRes.data.tasks);
        setMembers(membersRes.data.members);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load project.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function refetchTasks() {
    listTasks(projectId).then((res) => setTasks(res.data.tasks));
  }

  function refetchMembers() {
    listProjectMembers(projectId).then((res) => setMembers(res.data.members));
  }

  function handleDeleteProject() {
    setDeleting(true);
    deleteProject(projectId)
      .then(() => {
        toast.success("Project deleted.");
        navigate("/projects");
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to delete project.");
      })
      .finally(() => setDeleting(false));
  }

  function handleDeleteTask() {
    setDeletingTask(true);
    deleteTask(projectId, deleteTaskTarget.id)
      .then(() => {
        toast.success("Task deleted.");
        setDeleteTaskTarget(null);
        refetchTasks();
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to delete task.");
      })
      .finally(() => setDeletingTask(false));
  }

  const filteredTasks = useMemo(() => {
    const query = taskSearch.trim().toLowerCase();
    return tasks.filter((task) => {
      if (taskStatusFilter !== "all" && task.status !== taskStatusFilter) return false;
      if (taskPriorityFilter !== "all" && task.priority !== taskPriorityFilter) return false;
      if (taskAssigneeFilter !== "all") {
        if (taskAssigneeFilter === "unassigned" && task.assigned_to) return false;
        if (taskAssigneeFilter !== "unassigned" && String(task.assigned_to) !== taskAssigneeFilter)
          return false;
      }
      if (!query) return true;
      return task.title?.toLowerCase().includes(query);
    });
  }, [tasks, taskSearch, taskStatusFilter, taskPriorityFilter, taskAssigneeFilter]);

  if (loading) {
    return (
      <AppLayout title="Project Details">
        <Spinner label="Loading project..." />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Project Details">
        <ErrorState message={error} onRetry={fetchAll} />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={project.name}>
      <div className="space-y-6">
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
          <ArrowLeft size={15} /> Back to Projects
        </Link>

        <PageHeader
          title={project.name}
          description={project.description || "No description provided."}
          actions={
            <>
              {canEditProject(user) && (
                <Button
                  variant="secondary"
                  icon={Pencil}
                  onClick={() => navigate(`/projects/${projectId}/edit`)}
                >
                  Edit
                </Button>
              )}
              {canDeleteProject(user) && (
                <Button variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
              )}
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <ProjectStatusBadge status={project.status} />
          <ProjectPriorityBadge priority={project.priority} />
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar size={13} /> Start: {formatDate(project.start_date)}
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar size={13} /> Due: {formatDate(project.due_date)}
          </span>
        </div>

        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-slate-500 hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SectionCard title="Details">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd><ProjectStatusBadge status={project.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Priority</dt>
                  <dd><ProjectPriorityBadge priority={project.priority} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Start Date</dt>
                  <dd className="text-ink">{formatDate(project.start_date)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Due Date</dt>
                  <dd className="text-ink">{formatDate(project.due_date)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Created</dt>
                  <dd className="text-ink">{formatDate(project.created_at)}</dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard title="Summary">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Members</dt>
                  <dd className="text-ink">{members.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Tasks</dt>
                  <dd className="text-ink">{tasks.length}</dd>
                </div>
              </dl>
            </SectionCard>
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <SearchInput
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="Search tasks..."
                  className="sm:max-w-xs"
                />
                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All statuses</option>
                  {TASK_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="capitalize">
                      {opt.replace("_", " ")}
                    </option>
                  ))}
                </select>
                <select
                  value={taskPriorityFilter}
                  onChange={(e) => setTaskPriorityFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All priorities</option>
                  {TASK_PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="capitalize">
                      {opt}
                    </option>
                  ))}
                </select>
                <select
                  value={taskAssigneeFilter}
                  onChange={(e) => setTaskAssigneeFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All assignees</option>
                  <option value="unassigned">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user?.first_name} {m.user?.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {canCreateTask(user) && (
                <Button
                  icon={ListPlus}
                  onClick={() => {
                    setTaskModalMode("create");
                    setEditingTask(null);
                    setTaskModalOpen(true);
                  }}
                >
                  New Task
                </Button>
              )}
            </div>

            {filteredTasks.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No tasks found."
                description="Create a task or adjust your filters."
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
                        {(canEditTask(user) || canDeleteTask(user)) && (
                          <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                            <span className="sr-only">Actions</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          projectId={projectId}
                          canEdit={canEditTask(user)}
                          canDelete={canDeleteTask(user)}
                          onEdit={(t) => {
                            setTaskModalMode("edit");
                            setEditingTask(t);
                            setTaskModalOpen(true);
                          }}
                          onDelete={(t) => setDeleteTaskTarget(t)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "members" && (
          <ProjectMembersTab
            projectId={projectId}
            members={members}
            onChanged={refetchMembers}
            canManage={canManageProjectMembers(user)}
          />
        )}
      </div>

      <TaskFormModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        projectId={projectId}
        mode={taskModalMode}
        task={editingTask}
        projectMembers={members}
        onSaved={refetchTasks}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        description={`Delete "${project.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />

      <ConfirmDialog
        open={!!deleteTaskTarget}
        onClose={() => setDeleteTaskTarget(null)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        description={`Delete "${deleteTaskTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deletingTask}
      />
    </AppLayout>
  );
}

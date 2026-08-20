import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpDown,
  Calendar,
  CalendarClock,
  Check,
  Filter,
  ListChecks,
  ListPlus,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import SectionCard from "../../components/ui/SectionCard.jsx";
import Button from "../../components/ui/Button.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import ProjectStatusBadge from "../../components/projects/ProjectStatusBadge.jsx";
import ProjectPriorityBadge from "../../components/projects/ProjectPriorityBadge.jsx";
import ProjectMembersTab from "../../components/projects/ProjectMembersTab.jsx";
import TaskRow from "../../components/tasks/TaskRow.jsx";
import TaskCard from "../../components/tasks/TaskCard.jsx";
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

const TASK_VIEW_TABS = [
  { key: "kanban", label: "Kanban" },
  { key: "list", label: "List" },
  { key: "timeline", label: "Timeline" },
];

const TASK_COLUMNS = [
  { key: "todo", label: "To Do", dot: "bg-slate-400" },
  { key: "in_progress", label: "In Progress", dot: "bg-amber-500" },
  { key: "review", label: "In Review", dot: "bg-sky-500" },
  { key: "completed", label: "Completed", dot: "bg-emerald-500" },
];

const TASK_SORT_OPTIONS = [
  { key: "due_date", label: "Due date" },
  { key: "priority", label: "Priority" },
  { key: "created_at", label: "Created date" },
  { key: "title", label: "Title" },
];

const PRIORITY_WEIGHT = { urgent: 0, high: 1, medium: 2, low: 3 };

const selectClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";

const taskToolbarButtonClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50";

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
  const [taskView, setTaskView] = useState("kanban");
  const [taskSortBy, setTaskSortBy] = useState("due_date");
  const [openTaskMenu, setOpenTaskMenu] = useState(null);

  const taskToolbarRef = useRef(null);

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

  const sortedFilteredTasks = useMemo(() => {
    const arr = [...filteredTasks];
    arr.sort((a, b) => {
      switch (taskSortBy) {
        case "priority":
          return (
            (PRIORITY_WEIGHT[a.priority] ?? 99) - (PRIORITY_WEIGHT[b.priority] ?? 99)
          );
        case "created_at":
          return new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0);
        case "title":
          return (a.title ?? "").localeCompare(b.title ?? "");
        case "due_date":
        default: {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date) - new Date(b.due_date);
        }
      }
    });
    return arr;
  }, [filteredTasks, taskSortBy]);

  const groupedTasks = useMemo(
    () => ({
      todo: sortedFilteredTasks.filter((task) => task.status === "todo"),
      in_progress: sortedFilteredTasks.filter((task) => task.status === "in_progress"),
      review: sortedFilteredTasks.filter((task) => task.status === "review"),
      completed: sortedFilteredTasks.filter((task) => task.status === "completed"),
    }),
    [sortedFilteredTasks],
  );

  const taskActiveFilterCount =
    [taskStatusFilter, taskPriorityFilter].filter((v) => v !== "all").length +
    (taskSearch.trim() ? 1 : 0);

  function clearTaskFilters() {
    setTaskSearch("");
    setTaskStatusFilter("all");
    setTaskPriorityFilter("all");
  }

  function toggleTaskMenu(menu) {
    setOpenTaskMenu((current) => (current === menu ? null : menu));
  }

  function openCreateTaskModal() {
    setTaskModalMode("create");
    setEditingTask(null);
    setTaskModalOpen(true);
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (taskToolbarRef.current && !taskToolbarRef.current.contains(e.target)) {
        setOpenTaskMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
            <div
              ref={taskToolbarRef}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="inline-flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-1">
                {TASK_VIEW_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTaskView(tab.key)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      taskView === tab.key
                        ? "bg-white text-ink shadow-sm"
                        : "text-slate-500 hover:text-ink"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleTaskMenu("filter")}
                    className={taskToolbarButtonClass}
                  >
                    <Filter size={14} />
                    Filter
                    {taskActiveFilterCount > 0 && (
                      <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-semibold text-white">
                        {taskActiveFilterCount}
                      </span>
                    )}
                  </button>
                  {openTaskMenu === "filter" && (
                    <div className="absolute right-0 z-20 mt-2 w-72 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
                      <SearchInput
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        placeholder="Search tasks..."
                      />
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          Status
                        </label>
                        <select
                          value={taskStatusFilter}
                          onChange={(e) => setTaskStatusFilter(e.target.value)}
                          className={selectClass}
                        >
                          <option value="all">All statuses</option>
                          {TASK_STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          Priority
                        </label>
                        <select
                          value={taskPriorityFilter}
                          onChange={(e) => setTaskPriorityFilter(e.target.value)}
                          className={selectClass}
                        >
                          <option value="all">All priorities</option>
                          {TASK_PRIORITY_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                      {taskActiveFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={clearTaskFilters}
                          className="text-xs font-medium text-primary-600 hover:text-primary-700"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleTaskMenu("sort")}
                    className={taskToolbarButtonClass}
                  >
                    <ArrowUpDown size={14} />
                    Sort
                  </button>
                  {openTaskMenu === "sort" && (
                    <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                      {TASK_SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setTaskSortBy(opt.key);
                            setOpenTaskMenu(null);
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                        >
                          {opt.label}
                          {taskSortBy === opt.key && (
                            <Check size={14} className="text-primary-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleTaskMenu("assignees")}
                    className={taskToolbarButtonClass}
                  >
                    {members.length === 0 ? (
                      <Users size={14} />
                    ) : (
                      <span className="flex -space-x-2">
                        {members.slice(0, 3).map((m) => (
                          <span key={m.user_id} className="ring-2 ring-white rounded-full">
                            <Avatar
                              firstName={m.user?.first_name}
                              lastName={m.user?.last_name}
                              avatarUrl={m.user?.avatar_url}
                              size="sm"
                            />
                          </span>
                        ))}
                      </span>
                    )}
                    {members.length > 3 && (
                      <span className="text-xs font-medium text-slate-500">
                        +{members.length - 3}
                      </span>
                    )}
                    <span className="hidden sm:inline">Assignees</span>
                  </button>
                  {openTaskMenu === "assignees" && (
                    <div className="absolute right-0 z-20 mt-2 w-56 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setTaskAssigneeFilter("all");
                          setOpenTaskMenu(null);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                      >
                        All assignees
                        {taskAssigneeFilter === "all" && (
                          <Check size={14} className="text-primary-600" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTaskAssigneeFilter("unassigned");
                          setOpenTaskMenu(null);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                      >
                        Unassigned
                        {taskAssigneeFilter === "unassigned" && (
                          <Check size={14} className="text-primary-600" />
                        )}
                      </button>
                      {members.map((m) => (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() => {
                            setTaskAssigneeFilter(String(m.user_id));
                            setOpenTaskMenu(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                        >
                          <Avatar
                            firstName={m.user?.first_name}
                            lastName={m.user?.last_name}
                            avatarUrl={m.user?.avatar_url}
                            size="sm"
                          />
                          <span className="flex-1 truncate">
                            {m.user?.first_name} {m.user?.last_name}
                          </span>
                          {taskAssigneeFilter === String(m.user_id) && (
                            <Check size={14} className="text-primary-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {canCreateTask(user) && (
                  <Button icon={ListPlus} onClick={openCreateTaskModal}>
                    New Task
                  </Button>
                )}
              </div>
            </div>

            {sortedFilteredTasks.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No tasks found."
                description="Create a task or adjust your filters."
              />
            ) : (
              <>
                {taskView === "kanban" && (
                  <div className="overflow-x-auto pb-2">
                    <div className="flex min-w-max gap-4 sm:min-w-0">
                      {TASK_COLUMNS.map((col) => {
                        const columnTasks = groupedTasks[col.key] ?? [];
                        return (
                          <div
                            key={col.key}
                            className="flex w-[280px] shrink-0 flex-col rounded-2xl bg-slate-100 p-3 sm:w-[300px]"
                          >
                            <div className="mb-3 flex items-center justify-between px-1">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                                <span className="text-sm font-semibold text-ink">
                                  {col.label}
                                </span>
                                <span className="rounded-full bg-white px-1.5 py-0.5 text-xs font-medium text-slate-500">
                                  {String(columnTasks.length).padStart(2, "0")}
                                </span>
                              </div>
                              {canCreateTask(user) && (
                                <button
                                  type="button"
                                  onClick={openCreateTaskModal}
                                  className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-600"
                                  title="Add a task"
                                >
                                  <ListPlus size={16} />
                                </button>
                              )}
                            </div>
                            <div className="flex flex-col gap-3 overflow-y-auto">
                              {columnTasks.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-center text-xs text-slate-400">
                                  No tasks in this stage
                                </div>
                              ) : (
                                columnTasks.map((task) => (
                                  <TaskCard key={task.id} task={task} projectId={projectId} />
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {taskView === "list" && (
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
                          {sortedFilteredTasks.map((task) => (
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

                {taskView === "timeline" && (
                  <EmptyState
                    icon={CalendarClock}
                    title="Timeline view"
                    description="Timeline visualization is not available yet."
                  />
                )}
              </>
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

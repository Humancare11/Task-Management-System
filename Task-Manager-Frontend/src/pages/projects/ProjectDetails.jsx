import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpDown,
  Calendar,
  CalendarClock,
  Check,
  Filter,
  ListChecks,
  ListPlus,
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
import ProjectActivityTab from "../../components/projects/ProjectActivityTab.jsx";
import TaskStatusBadge from "../../components/tasks/TaskStatusBadge.jsx";
import TaskPriorityBadge from "../../components/tasks/TaskPriorityBadge.jsx";
import TaskRow from "../../components/tasks/TaskRow.jsx";
import TaskCard from "../../components/tasks/TaskCard.jsx";
import TaskFormModal from "../../components/tasks/TaskFormModal.jsx";
import { getProject } from "../../api/projects.js";
import { listTasks, deleteTask } from "../../api/tasks.js";
import { listProjectMembers } from "../../api/projectMembers.js";
import { getSocket } from "../../lib/socket.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import {
  canManageProjectMembers,
  canCreateTask,
  canEditTask,
  canDeleteTask,
} from "../../config/permissions.js";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "tasks", label: "Tasks" },
  { key: "members", label: "Members" },
  { key: "activity", label: "Activity" },
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
  "w-full rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue";

const taskToolbarButtonClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm font-medium text-txt-muted hover:bg-surface-2";

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

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Project Edit/Delete actions live in the Projects list 3-dot menu
  // (RowActions) to avoid duplicating them on this detail page.

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

  useEffect(() => {
    const socket = getSocket();
    socket.emit("project:join", projectId);

    function handleTaskCreated(task) {
      setTasks((prev) => [task, ...prev]);
    }
    function handleTaskUpdated(task) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    }
    function handleTaskDeleted({ taskId }) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }

    socket.on("task:created", handleTaskCreated);
    socket.on("task:updated", handleTaskUpdated);
    socket.on("task:deleted", handleTaskDeleted);

    return () => {
      socket.emit("project:leave", projectId);
      socket.off("task:created", handleTaskCreated);
      socket.off("task:updated", handleTaskUpdated);
      socket.off("task:deleted", handleTaskDeleted);
    };
  }, [projectId]);

  function refetchTasks() {
    listTasks(projectId).then((res) => setTasks(res.data.tasks));
  }

  function refetchMembers() {
    listProjectMembers(projectId).then((res) => setMembers(res.data.members));
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

  // Overview dashboard figures — derived entirely from already-loaded
  // project / tasks / members data. No extra requests.
  const overview = useMemo(() => {
    const total = tasks.length;
    const counts = { todo: 0, in_progress: 0, review: 0, completed: 0 };
    tasks.forEach((task) => {
      if (counts[task.status] !== undefined) counts[task.status] += 1;
    });
    const progress = total > 0 ? Math.round((counts.completed / total) * 100) : null;
    const recent = [...tasks]
      .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0))
      .slice(0, 5);
    return { total, counts, completed: counts.completed, progress, recent };
  }, [tasks]);

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

  if (!project) {
    return (
      <AppLayout title="Project Details">
        <ErrorState message="Project not found." onRetry={fetchAll} />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={project.name}>
      <div className="space-y-6">
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-txt-muted hover:text-txt-primary">
          <ArrowLeft size={15} /> Back to Projects
        </Link>

        <PageHeader
          title={project.name}
          description={project.description || "No description provided."}
        />

        <div className="flex flex-wrap items-center gap-3">
          <ProjectStatusBadge status={project.status} />
          <ProjectPriorityBadge priority={project.priority} />
          <span className="flex items-center gap-1 text-xs text-txt-muted">
            <Calendar size={13} /> Start: {formatDate(project.start_date)}
          </span>
          <span className="flex items-center gap-1 text-xs text-txt-muted">
            <Calendar size={13} /> Due: {formatDate(project.due_date)}
          </span>
        </div>

        <div className="flex gap-1 border-b border-hair">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-accentblue text-accentblue"
                  : "border-transparent text-txt-muted hover:text-txt-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: "Tasks", value: overview.total, note: "Total tasks" },
                { label: "Completed", value: overview.completed, note: "Completed" },
                { label: "Members", value: members.length, note: "Team members" },
                {
                  label: "Progress",
                  value: overview.progress === null ? "--" : `${overview.progress}%`,
                  note: "Tasks completed",
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-xl border border-hair bg-surface-1 p-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-txt-muted">
                    {kpi.label}
                  </p>
                  <p className="mt-1.5 text-[20px] font-medium text-txt-primary">
                    {kpi.value}
                  </p>
                  <p className="mt-1 text-[11px] text-txt-muted">{kpi.note}</p>
                </div>
              ))}
            </div>

            {/* Progress + Task status */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard
                title="Project Progress"
                actions={
                  <span className="text-sm font-semibold text-txt-primary">
                    {overview.progress === null ? "--" : `${overview.progress}%`}
                  </span>
                }
              >
                {overview.total === 0 ? (
                  <p className="text-sm text-txt-muted">
                    No tasks yet — progress will appear once tasks are added.
                  </p>
                ) : (
                  <>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-accentblue transition-all"
                        style={{ width: `${overview.progress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-txt-muted">
                      {overview.completed} of {overview.total} tasks completed
                    </p>
                  </>
                )}
              </SectionCard>

              <SectionCard title="Task Status">
                {overview.total === 0 ? (
                  <p className="text-sm text-txt-muted">No tasks yet.</p>
                ) : (
                  <ul className="space-y-2.5 text-sm">
                    {TASK_COLUMNS.map((col) => (
                      <li
                        key={col.key}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2 text-txt-muted">
                          <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                          {col.label}
                        </span>
                        <span className="font-medium text-txt-primary">
                          {overview.counts[col.key]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>

            {/* Timeline + Project information */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard title="Project Timeline">
                <ol className="space-y-4 text-sm">
                  {[
                    { label: "Start Date", value: project.start_date },
                    { label: "Due Date", value: project.due_date },
                    { label: "Created", value: project.created_at },
                  ].map((item) => (
                    <li key={item.label} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-txt-muted">
                        <Calendar size={14} />
                      </span>
                      <div>
                        <p className="text-xs text-txt-muted">{item.label}</p>
                        <p className="text-txt-primary">{formatDate(item.value)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </SectionCard>

              <SectionCard title="Project Information">
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-txt-muted">Status</dt>
                    <dd>
                      <ProjectStatusBadge status={project.status} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-txt-muted">Priority</dt>
                    <dd>
                      <ProjectPriorityBadge priority={project.priority} />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-txt-muted">Start Date</dt>
                    <dd className="text-txt-primary">
                      {formatDate(project.start_date)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-txt-muted">Due Date</dt>
                    <dd className="text-txt-primary">
                      {formatDate(project.due_date)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-txt-muted">Created</dt>
                    <dd className="text-txt-primary">
                      {formatDate(project.created_at)}
                    </dd>
                  </div>
                </dl>
              </SectionCard>
            </div>

            {/* Recent / active tasks */}
            <SectionCard
              title="Project Tasks"
              actions={
                <button
                  type="button"
                  onClick={() => setActiveTab("tasks")}
                  className="text-[11px] font-medium text-accentblue hover:text-accentblue-icon"
                >
                  View all
                </button>
              }
            >
              {overview.recent.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="No tasks yet."
                  description="Tasks created for this project will appear here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-hair">
                        {["Task", "Priority", "Status", "Due"].map((c) => (
                          <th
                            key={c}
                            className="pb-2 pr-4 text-[10.5px] font-medium uppercase tracking-[0.06em] text-txt-muted"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {overview.recent.map((task) => (
                        <tr
                          key={task.id}
                          className="border-b border-hair last:border-0"
                        >
                          <td className="py-2.5 pr-4 font-medium text-txt-primary">
                            {task.title}
                          </td>
                          <td className="py-2.5 pr-4">
                            <TaskPriorityBadge priority={task.priority} />
                          </td>
                          <td className="py-2.5 pr-4">
                            <TaskStatusBadge status={task.status} />
                          </td>
                          <td className="py-2.5 pr-4 text-txt-muted">
                            {formatDate(task.due_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            {/* Quick actions — existing handlers only */}
            <SectionCard title="Quick Actions">
              <div className="flex flex-wrap gap-2">
                {canCreateTask(user) && (
                  <Button icon={ListPlus} size="sm" onClick={openCreateTaskModal}>
                    New Task
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTab("tasks")}
                >
                  View Tasks
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTab("members")}
                >
                  View Members
                </Button>
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-4">
            <div
              ref={taskToolbarRef}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="inline-flex w-fit rounded-lg border border-hair bg-surface-2 p-1">
                {TASK_VIEW_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTaskView(tab.key)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      taskView === tab.key
                        ? "bg-surface-1 text-txt-primary shadow-sm"
                        : "text-txt-muted hover:text-txt-primary"
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
                      <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accentblue text-[10px] font-semibold text-white">
                        {taskActiveFilterCount}
                      </span>
                    )}
                  </button>
                  {openTaskMenu === "filter" && (
                    <div className="absolute right-0 z-20 mt-2 w-72 space-y-3 rounded-xl border border-hair bg-surface-1 p-4 shadow-lg">
                      <SearchInput
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        placeholder="Search tasks..."
                      />
                      <div>
                        <label className="mb-1 block text-xs font-medium text-txt-muted">
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
                        <label className="mb-1 block text-xs font-medium text-txt-muted">
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
                          className="text-xs font-medium text-accentblue hover:text-accentblue"
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
                    <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-hair bg-surface-1 p-1.5 shadow-lg">
                      {TASK_SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setTaskSortBy(opt.key);
                            setOpenTaskMenu(null);
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-txt-muted hover:bg-surface-2"
                        >
                          {opt.label}
                          {taskSortBy === opt.key && (
                            <Check size={14} className="text-accentblue" />
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
                          <span key={m.user_id} className="ring-2 ring-surface-1 rounded-full">
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
                      <span className="text-xs font-medium text-txt-muted">
                        +{members.length - 3}
                      </span>
                    )}
                    <span className="hidden sm:inline">Assignees</span>
                  </button>
                  {openTaskMenu === "assignees" && (
                    <div className="absolute right-0 z-20 mt-2 w-56 max-h-72 overflow-y-auto rounded-xl border border-hair bg-surface-1 p-1.5 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setTaskAssigneeFilter("all");
                          setOpenTaskMenu(null);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-txt-muted hover:bg-surface-2"
                      >
                        All assignees
                        {taskAssigneeFilter === "all" && (
                          <Check size={14} className="text-accentblue" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTaskAssigneeFilter("unassigned");
                          setOpenTaskMenu(null);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-txt-muted hover:bg-surface-2"
                      >
                        Unassigned
                        {taskAssigneeFilter === "unassigned" && (
                          <Check size={14} className="text-accentblue" />
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
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-txt-muted hover:bg-surface-2"
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
                            <Check size={14} className="text-accentblue" />
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
                            className="flex w-[280px] shrink-0 flex-col rounded-2xl bg-surface-2 p-3 sm:w-[300px]"
                          >
                            <div className="mb-3 flex items-center justify-between px-1">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                                <span className="text-sm font-semibold text-txt-primary">
                                  {col.label}
                                </span>
                                <span className="rounded-full bg-surface-1 px-1.5 py-0.5 text-xs font-medium text-txt-muted">
                                  {String(columnTasks.length).padStart(2, "0")}
                                </span>
                              </div>
                              {canCreateTask(user) && (
                                <button
                                  type="button"
                                  onClick={openCreateTaskModal}
                                  className="rounded-md p-1 text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
                                  title="Add a task"
                                >
                                  <ListPlus size={16} />
                                </button>
                              )}
                            </div>
                            <div className="flex flex-col gap-3 overflow-y-auto">
                              {columnTasks.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-hair bg-surface-1/60 p-4 text-center text-xs text-txt-muted">
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
                  <div className="overflow-hidden rounded-xl border border-hair bg-surface-1">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="border-b border-hair bg-surface-2">
                          <tr>
                            <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Title</th>
                            <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Status</th>
                            <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Priority</th>
                            <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Assignee</th>
                            <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Due Date</th>
                            {(canEditTask(user) || canDeleteTask(user)) && (
                              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">
                                <span className="sr-only">Actions</span>
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hair">
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

        {activeTab === "activity" && (
          <ProjectActivityTab projectId={projectId} />
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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ListChecks,
  Plus,
  Filter,
  ArrowUpDown,
  Users,
  CalendarClock,
  CalendarRange,
  Columns3,
  List,
  Check,
} from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import Button from "../../components/ui/Button.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import TaskRow from "../../components/tasks/TaskRow.jsx";
import TaskCard from "../../components/tasks/TaskCard.jsx";
import TaskFormModal from "../../components/tasks/TaskFormModal.jsx";
import { listProjects } from "../../api/projects.js";
import { listTasks } from "../../api/tasks.js";
import { listProjectMembers } from "../../api/projectMembers.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { canCreateTask } from "../../config/permissions.js";

const STATUS_OPTIONS = ["todo", "in_progress", "review", "completed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

// Timeline is intentionally disabled — timeline functionality is planned for a
// future implementation. Do not wire it up or add mock data here.
const VIEW_TABS = [
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "list", label: "List", icon: List },
  { key: "timeline", label: "Timeline", icon: CalendarRange, disabled: true },
];

const COLUMNS = [
  { key: "todo", label: "To Do", dot: "bg-slate-400" },
  { key: "in_progress", label: "In Progress", dot: "bg-amber-500" },
  { key: "review", label: "In Review", dot: "bg-sky-500" },
  { key: "completed", label: "Completed", dot: "bg-emerald-500" },
];

const SORT_OPTIONS = [
  { key: "due_date", label: "Due date" },
  { key: "priority", label: "Priority" },
  { key: "created_at", label: "Created date" },
  { key: "title", label: "Title" },
];

const PRIORITY_WEIGHT = { urgent: 0, high: 1, medium: 2, low: 3 };

const selectClass =
  "w-full rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue";

const toolbarButtonClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm font-medium text-txt-muted transition-colors hover:bg-surface-2 hover:text-txt-primary";

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [view, setView] = useState("kanban");
  const [sortBy, setSortBy] = useState("due_date");
  const [openMenu, setOpenMenu] = useState(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalProjectId, setTaskModalProjectId] = useState(null);
  const [taskModalMembers, setTaskModalMembers] = useState([]);

  const toolbarRef = useRef(null);
  const addMenuRef = useRef(null);

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

  useEffect(() => {
    function handleClickOutside(e) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
        setAddMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openTaskModalForProject(projectId) {
    setAddMenuOpen(false);
    listProjectMembers(projectId)
      .then((res) => {
        setTaskModalMembers(res.data.members);
        setTaskModalProjectId(projectId);
        setTaskModalOpen(true);
      })
      .catch(() => {
        setTaskModalMembers([]);
        setTaskModalProjectId(projectId);
        setTaskModalOpen(true);
      });
  }

  function handleAddTaskClick() {
    if (projects.length === 1) {
      openTaskModalForProject(projects[0].id);
    } else {
      setAddMenuOpen((v) => !v);
    }
  }

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter)
        return false;
      if (projectFilter !== "all" && String(task.project_id) !== projectFilter)
        return false;
      if (
        assigneeFilter !== "all" &&
        String(task.assigned_to) !== assigneeFilter
      )
        return false;
      if (!query) return true;
      return task.title?.toLowerCase().includes(query);
    });
  }, [
    tasks,
    search,
    statusFilter,
    priorityFilter,
    projectFilter,
    assigneeFilter,
  ]);

  const sortedTasks = useMemo(() => {
    const arr = [...filteredTasks];
    arr.sort((a, b) => {
      switch (sortBy) {
        case "priority":
          return (
            (PRIORITY_WEIGHT[a.priority] ?? 99) -
            (PRIORITY_WEIGHT[b.priority] ?? 99)
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
  }, [filteredTasks, sortBy]);

  const groupedTasks = useMemo(
    () => ({
      todo: sortedTasks.filter((task) => task.status === "todo"),
      in_progress: sortedTasks.filter((task) => task.status === "in_progress"),
      review: sortedTasks.filter((task) => task.status === "review"),
      completed: sortedTasks.filter((task) => task.status === "completed"),
    }),
    [sortedTasks],
  );

  const uniqueAssignees = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      if (task.assignee) {
        const key = String(
          task.assigned_to ??
            `${task.assignee.first_name}-${task.assignee.last_name}`,
        );
        if (!map.has(key)) map.set(key, task.assignee);
      }
    });
    return Array.from(map.entries());
  }, [tasks]);

  const activeFilterCount =
    [statusFilter, priorityFilter, projectFilter].filter((v) => v !== "all")
      .length + (search.trim() ? 1 : 0);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setProjectFilter("all");
  }

  function toggleMenu(menu) {
    setOpenMenu((current) => (current === menu ? null : menu));
  }

  const canAddTask = canCreateTask(user) && projects.length > 0;

  return (
    <AppLayout title="Tasks">
      <div className="space-y-6">
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
            <PageHeader
              title="Tasks"
              description="Manage and track your team's project tasks"
              actions={
                <div ref={addMenuRef} className="relative">
                  <Button
                    icon={Plus}
                    onClick={handleAddTaskClick}
                    disabled={!canAddTask}
                    title={
                      !canCreateTask(user)
                        ? "You don't have permission to create tasks."
                        : projects.length === 0
                          ? "Create a project first."
                          : undefined
                    }
                  >
                    Add New Task
                  </Button>
                  {addMenuOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-64 max-h-72 overflow-y-auto rounded-xl border border-hair bg-surface-1 p-1.5 shadow-lg">
                      <p className="px-2.5 py-1.5 text-xs font-medium text-txt-muted">
                        Choose a project
                      </p>
                      {projects.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => openTaskModalForProject(p.id)}
                          className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              }
            />

            <div
              ref={toolbarRef}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              {/* Segmented view switcher. Timeline stays visible but disabled
                  until timeline functionality is built. */}
              <div className="inline-flex w-fit items-center gap-0.5 rounded-lg border border-hair bg-surface-1 p-0.5">
                {VIEW_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = view === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      disabled={tab.disabled}
                      aria-pressed={isActive}
                      onClick={() => {
                        if (!tab.disabled) setView(tab.key);
                      }}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        isActive
                          ? "bg-accentblue text-white shadow-sm"
                          : tab.disabled
                            ? "cursor-not-allowed text-txt-muted/50"
                            : "text-txt-muted hover:text-txt-primary"
                      }`}
                    >
                      <Icon size={14} />
                      {tab.label}
                      {tab.disabled && (
                        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-txt-muted">
                          Soon
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => toggleMenu("filter")}
                      className={toolbarButtonClass}
                    >
                      <Filter size={14} />
                      Filter
                      {activeFilterCount > 0 && (
                        <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accentblue text-[10px] font-semibold text-white">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                    {openMenu === "filter" && (
                      <div className="absolute right-0 z-20 mt-2 w-72 space-y-3 rounded-xl border border-hair bg-surface-1 p-4 shadow-lg">
                        <SearchInput
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search tasks..."
                        />
                        <div>
                          <label className="mb-1 block text-xs font-medium text-txt-muted">
                            Status
                          </label>
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className={selectClass}
                          >
                            <option value="all">All statuses</option>
                            {STATUS_OPTIONS.map((opt) => (
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
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className={selectClass}
                          >
                            <option value="all">All priorities</option>
                            {PRIORITY_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-txt-muted">
                            Project
                          </label>
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
                        {activeFilterCount > 0 && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="text-xs font-medium text-accentblue hover:text-accentblue-hover"
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
                      onClick={() => toggleMenu("sort")}
                      className={toolbarButtonClass}
                    >
                      <ArrowUpDown size={14} />
                      Sort
                    </button>
                    {openMenu === "sort" && (
                      <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-hair bg-surface-1 p-1.5 shadow-lg">
                        {SORT_OPTIONS.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              setSortBy(opt.key);
                              setOpenMenu(null);
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-txt-muted hover:bg-surface-2"
                          >
                            {opt.label}
                            {sortBy === opt.key && (
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
                      onClick={() => toggleMenu("assignees")}
                      className={toolbarButtonClass}
                    >
                      {uniqueAssignees.length === 0 ? (
                        <Users size={14} />
                      ) : (
                        <span className="flex -space-x-2">
                          {uniqueAssignees
                            .slice(0, 3)
                            .map(([key, assignee]) => (
                              <span
                                key={key}
                                className="ring-2 ring-surface-1 rounded-full"
                              >
                                <Avatar
                                  firstName={assignee.first_name}
                                  lastName={assignee.last_name}
                                  avatarUrl={assignee.avatar_url}
                                  size="sm"
                                />
                              </span>
                            ))}
                        </span>
                      )}
                      {uniqueAssignees.length > 3 && (
                        <span className="text-xs font-medium text-txt-muted">
                          +{uniqueAssignees.length - 3}
                        </span>
                      )}
                      <span className="hidden sm:inline">Assignees</span>
                    </button>
                    {openMenu === "assignees" && (
                      <div className="absolute right-0 z-20 mt-2 w-56 max-h-72 overflow-y-auto rounded-xl border border-hair bg-surface-1 p-1.5 shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setAssigneeFilter("all");
                            setOpenMenu(null);
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-txt-muted hover:bg-surface-2"
                        >
                          All assignees
                          {assigneeFilter === "all" && (
                            <Check size={14} className="text-accentblue" />
                          )}
                        </button>
                        {uniqueAssignees.map(([key, assignee]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setAssigneeFilter(key);
                              setOpenMenu(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-txt-muted hover:bg-surface-2"
                          >
                            <Avatar
                              firstName={assignee.first_name}
                              lastName={assignee.last_name}
                              avatarUrl={assignee.avatar_url}
                              size="sm"
                            />
                            <span className="flex-1 truncate">
                              {assignee.first_name} {assignee.last_name}
                            </span>
                            {assigneeFilter === key && (
                              <Check size={14} className="text-accentblue" />
                            )}
                          </button>
                        ))}
                        {uniqueAssignees.length === 0 && (
                          <p className="px-2.5 py-2 text-sm text-txt-muted">
                            No assignees yet.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            {sortedTasks.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No tasks match your filters."
                description="Try a different search term, status, priority, or project."
              />
            ) : (
              <>
                {view === "kanban" && (
                  <div className="overflow-x-auto pb-2">
                    <div className="flex min-w-max gap-4 sm:min-w-0">
                      {COLUMNS.map((col) => {
                        const columnTasks = groupedTasks[col.key] ?? [];
                        return (
                          <div
                            key={col.key}
                            className="flex w-[280px] shrink-0 flex-col rounded-2xl bg-surface-2 p-3 sm:w-[300px]"
                          >
                            <div className="mb-3 flex items-center justify-between px-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 rounded-full ${col.dot}`}
                                />
                                <span className="text-sm font-semibold text-txt-primary">
                                  {col.label}
                                </span>
                                <span className="rounded-full bg-surface-1 px-1.5 py-0.5 text-xs font-medium text-txt-muted">
                                  {String(columnTasks.length).padStart(2, "0")}
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled
                                title="Open a project to create a task."
                                className="rounded-md p-1 text-txt-muted disabled:cursor-not-allowed"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                            <div className="flex flex-col gap-3 overflow-y-auto">
                              {columnTasks.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-hair bg-surface-1/60 p-4 text-center text-xs text-txt-muted">
                                  No tasks in this stage
                                </div>
                              ) : (
                                columnTasks.map((task) => (
                                  <TaskCard
                                    key={`${task.project_id}-${task.id}`}
                                    task={task}
                                    projectId={task.project_id}
                                  />
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {view === "list" && (
                  <div className="overflow-hidden rounded-xl border border-hair bg-surface-1">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="border-b border-hair bg-surface-2">
                          <tr>
                            <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">
                              Task
                            </th>
                            <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">
                              Status
                            </th>
                            <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">
                              Priority
                            </th>
                            <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">
                              Assignee
                            </th>
                            <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">
                              Due Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hair">
                          {sortedTasks.map((task) => (
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

                {view === "timeline" && (
                  <EmptyState
                    icon={CalendarClock}
                    title="Timeline view"
                    description="Timeline visualization is not available yet."
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      <TaskFormModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        projectId={taskModalProjectId}
        mode="create"
        projectMembers={taskModalMembers}
        onSaved={fetchAll}
      />
    </AppLayout>
  );
}

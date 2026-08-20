import { useEffect, useMemo, useRef, useState } from "react";
import {
  ListChecks,
  Plus,
  Filter,
  ArrowUpDown,
  Users,
  CalendarClock,
  Check,
} from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
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

const VIEW_TABS = [
  { key: "kanban", label: "Kanban" },
  { key: "list", label: "List" },
  { key: "timeline", label: "Timeline" },
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
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";

const toolbarButtonClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50";

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
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">
                    Task Design
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Manage and track your team's project tasks
                  </p>
                </div>
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
                    <div className="absolute right-0 z-20 mt-2 w-64 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                      <p className="px-2.5 py-1.5 text-xs font-medium text-slate-400">
                        Choose a project
                      </p>
                      {projects.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => openTaskModalForProject(p.id)}
                          className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div
                ref={toolbarRef}
                className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="inline-flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-1">
                  {VIEW_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setView(tab.key)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        view === tab.key
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
                      onClick={() => toggleMenu("filter")}
                      className={toolbarButtonClass}
                    >
                      <Filter size={14} />
                      Filter
                      {activeFilterCount > 0 && (
                        <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-semibold text-white">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                    {openMenu === "filter" && (
                      <div className="absolute right-0 z-20 mt-2 w-72 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
                        <SearchInput
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search tasks..."
                        />
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">
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
                          <label className="mb-1 block text-xs font-medium text-slate-500">
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
                          <label className="mb-1 block text-xs font-medium text-slate-500">
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
                      onClick={() => toggleMenu("sort")}
                      className={toolbarButtonClass}
                    >
                      <ArrowUpDown size={14} />
                      Sort
                    </button>
                    {openMenu === "sort" && (
                      <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                        {SORT_OPTIONS.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              setSortBy(opt.key);
                              setOpenMenu(null);
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                          >
                            {opt.label}
                            {sortBy === opt.key && (
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
                                className="ring-2 ring-white rounded-full"
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
                        <span className="text-xs font-medium text-slate-500">
                          +{uniqueAssignees.length - 3}
                        </span>
                      )}
                      <span className="hidden sm:inline">Assignees</span>
                    </button>
                    {openMenu === "assignees" && (
                      <div className="absolute right-0 z-20 mt-2 w-56 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setAssigneeFilter("all");
                            setOpenMenu(null);
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                        >
                          All assignees
                          {assigneeFilter === "all" && (
                            <Check size={14} className="text-primary-600" />
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
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
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
                              <Check size={14} className="text-primary-600" />
                            )}
                          </button>
                        ))}
                        {uniqueAssignees.length === 0 && (
                          <p className="px-2.5 py-2 text-sm text-slate-400">
                            No assignees yet.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
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
                            className="flex w-[280px] shrink-0 flex-col rounded-2xl bg-slate-100 p-3 sm:w-[300px]"
                          >
                            <div className="mb-3 flex items-center justify-between px-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 rounded-full ${col.dot}`}
                                />
                                <span className="text-sm font-semibold text-ink">
                                  {col.label}
                                </span>
                                <span className="rounded-full bg-white px-1.5 py-0.5 text-xs font-medium text-slate-500">
                                  {String(columnTasks.length).padStart(2, "0")}
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled
                                title="Open a project to create a task."
                                className="rounded-md p-1 text-slate-400 disabled:cursor-not-allowed"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                            <div className="flex flex-col gap-3 overflow-y-auto">
                              {columnTasks.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-center text-xs text-slate-400">
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
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
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

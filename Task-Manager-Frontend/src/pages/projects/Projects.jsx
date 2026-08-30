import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FolderKanban,
  FolderPlus,
  Calendar,
  MoreVertical,
  LayoutGrid,
  List,
  ChevronDown,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import ProjectStatusBadge from "../../components/projects/ProjectStatusBadge.jsx";
import ProjectPriorityBadge from "../../components/projects/ProjectPriorityBadge.jsx";
import ProjectCard from "../../components/projects/ProjectCard.jsx";
import ProjectFormModal from "../../components/projects/ProjectFormModal.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import { listProjects, deleteProject } from "../../api/projects.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import {
  canCreateProject,
  canEditProject,
  canDeleteProject,
} from "../../config/permissions.js";

const STATUS_OPTIONS = [
  "planned",
  "active",
  "on_hold",
  "completed",
  "archived",
];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

const selectClass =
  "appearance-none rounded-lg border border-hair bg-surface-1 py-2 pl-3 pr-8 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue";

function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Select({ value, onChange, children }) {
  return (
    <div className="relative">
      <select value={value} onChange={onChange} className={selectClass}>
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-txt-muted"
      />
    </div>
  );
}

// Project actions are managed from the list to avoid
// duplicating Edit/Delete controls on the detail page.
// "Open" navigates to the existing detail route; "Edit" opens the shared
// Edit Project drawer; "Delete" uses the existing ConfirmDialog + deleteProject.
function RowActions({ projectId, canEdit, canDelete, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function place() {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) setCoords({ top: rect.bottom + 4, left: rect.right - 144 });
    }
    function onPointerDown(e) {
      if (
        !btnRef.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded-md p-1.5 text-txt-muted transition-colors hover:bg-surface-2 hover:text-txt-primary"
        aria-label="Project actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", top: coords.top, left: coords.left }}
            className="z-50 w-36 overflow-hidden rounded-lg border border-hair bg-surface-1 py-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {canEdit && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onEdit?.();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-txt-primary hover:bg-surface-2"
              >
                Edit
              </button>
            )}
            <Link
              to={`/projects/${projectId}`}
              role="menuitem"
              className="block px-3 py-2 text-sm text-txt-primary hover:bg-surface-2"
            >
              Open
            </Link>
            {canDelete && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onDelete?.();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-surface-2 dark:text-red-400"
              >
                Delete
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [view, setView] = useState("list"); // "list" | "grid" — presentation only

  const [searchParams, setSearchParams] = useSearchParams();
  const userCanCreate = canCreateProject(user);
  const [createOpen, setCreateOpen] = useState(
    () => userCanCreate && searchParams.get("create") === "1",
  );
  const [editProject, setEditProject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const userCanEdit = canEditProject(user);
  const userCanDelete = canDeleteProject(user);

  // Uses the existing deleteProject API + ConfirmDialog pattern; refreshes
  // the list via the existing fetchProjects. No new endpoint or contract.
  function handleDeleteProject() {
    if (!deleteTarget) return;
    setDeleting(true);
    deleteProject(deleteTarget.id)
      .then(() => {
        toast.success("Project deleted.");
        setDeleteTarget(null);
        fetchProjects();
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to delete project.");
      })
      .finally(() => setDeleting(false));
  }

  function openCreate() {
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    if (searchParams.get("create")) {
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next, { replace: true });
    }
  }

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    if (userCanCreate) {
      setCreateOpen(true);
    } else {
      // Strip the query param for users who cannot create projects, keeping
      // them on the Projects page with the modal closed.
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, userCanCreate, setSearchParams]);

  function fetchProjects() {
    setLoading(true);
    setError("");
    listProjects()
      .then((res) => setProjects(res.data.projects))
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load projects.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (statusFilter !== "all" && project.status !== statusFilter)
        return false;
      if (priorityFilter !== "all" && project.priority !== priorityFilter)
        return false;
      if (!query) return true;
      return (
        project.name?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query)
      );
    });
  }, [projects, search, statusFilter, priorityFilter]);

  const totalLabel = !loading && !error ? `${projects.length} total` : "";

  return (
    <AppLayout title="Projects">
      <div className="mx-auto flex flex-col gap-5">
        <PageHeader
          title="Projects"
          description={
            totalLabel
              ? `Track and organize your team's work. ${totalLabel}.`
              : "Track and organize your team's work."
          }
          actions={
            canCreateProject(user) && (
              <Button icon={FolderPlus} onClick={openCreate}>
                Create project
              </Button>
            )
          }
        />

        {loading && <Spinner label="Loading projects..." />}

        {!loading && error && (
          <ErrorState message={error} onRetry={fetchProjects} />
        )}

        {!loading && !error && projects.length === 0 && (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet."
            description="Create your first project to start organizing your team's work."
            action={
              canCreateProject(user) && (
                <Button icon={FolderPlus} size="sm" onClick={openCreate}>
                  Create project
                </Button>
              )
            }
          />
        )}

        {!loading && !error && projects.length > 0 && (
          <>
            {/* Toolbar */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="sm:max-w-xs sm:flex-1"
              />

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.replace("_", " ")}
                    </option>
                  ))}
                </Select>

                <Select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="all">All priorities</option>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              </div>

              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-hair bg-surface-1 p-0.5 sm:ml-auto">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                  title="List view"
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    view === "list"
                      ? "bg-surface-2 text-txt-primary"
                      : "text-txt-muted hover:text-txt-primary"
                  }`}
                >
                  <List size={14} />
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-pressed={view === "grid"}
                  title="Grid view"
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    view === "grid"
                      ? "bg-surface-2 text-txt-primary"
                      : "text-txt-muted hover:text-txt-primary"
                  }`}
                >
                  <LayoutGrid size={14} />
                  Grid
                </button>
              </div>
            </div>

            {/* Section header */}
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-txt-primary">
                All projects
              </h2>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-txt-muted">
                {projects.length}
              </span>
            </div>

            {filteredProjects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects match your filters."
                description="Try a different search term, status, or priority."
              />
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-hair bg-surface-1">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
                    <colgroup>
                      <col />
                      <col className="w-[200px]" />
                      <col className="w-[130px]" />
                      <col className="w-[120px]" />
                      <col className="w-[150px]" />
                      <col className="w-[56px]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-hair text-left">
                        {[
                          "Project",
                          "Owner",
                          "Status",
                          "Priority",
                          "Due date",
                          "",
                        ].map((col, i) => (
                          <th
                            key={col || `col-${i}`}
                            className="px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-txt-muted"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProjects.map((project) => {
                        const owner = project.owner || project.creator || null;
                        return (
                          <tr
                            key={project.id}
                            onClick={() => navigate(`/projects/${project.id}`)}
                            className="cursor-pointer border-b border-hair transition-colors last:border-0 hover:bg-surface-2"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accentblue">
                                  <FolderKanban size={15} />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-txt-primary">
                                    {project.name}
                                  </p>
                                  <p className="truncate text-xs text-txt-muted">
                                    {project.description ||
                                      "No description provided."}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {owner ? (
                                <div className="flex items-center gap-2">
                                  <Avatar
                                    firstName={owner.first_name}
                                    lastName={owner.last_name}
                                    avatarUrl={owner.avatar_url}
                                    size="sm"
                                  />
                                  <span className="truncate text-txt-primary">
                                    {owner.first_name} {owner.last_name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-txt-muted">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <ProjectStatusBadge status={project.status} />
                            </td>
                            <td className="px-4 py-3">
                              <ProjectPriorityBadge
                                priority={project.priority}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1.5 text-xs text-txt-muted">
                                <Calendar size={13} />
                                {formatDate(project.due_date)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <RowActions
                                projectId={project.id}
                                canEdit={userCanEdit}
                                canDelete={userCanDelete}
                                onEdit={() => setEditProject(project)}
                                onDelete={() => setDeleteTarget(project)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ProjectFormModal
        open={createOpen}
        onClose={closeCreate}
        onSaved={fetchProjects}
      />

      <ProjectFormModal
        mode="edit"
        open={!!editProject}
        project={editProject}
        onClose={() => setEditProject(null)}
        onSaved={fetchProjects}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </AppLayout>
  );
}

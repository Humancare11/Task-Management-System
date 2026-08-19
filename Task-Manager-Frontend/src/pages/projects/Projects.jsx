import { useEffect, useMemo, useState } from "react";
import { FolderKanban, FolderPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import ProjectCard from "../../components/projects/ProjectCard.jsx";
import { listProjects } from "../../api/projects.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { canCreateProject } from "../../config/permissions.js";

const STATUS_OPTIONS = ["planned", "active", "on_hold", "completed", "archived"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

const selectClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

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
      if (statusFilter !== "all" && project.status !== statusFilter) return false;
      if (priorityFilter !== "all" && project.priority !== priorityFilter) return false;
      if (!query) return true;
      return (
        project.name?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query)
      );
    });
  }, [projects, search, statusFilter, priorityFilter]);

  return (
    <AppLayout title="Projects">
      <div className="space-y-6">
        <PageHeader
          title="Projects"
          description={`Track and organize your team's work. ${
            !loading && !error ? `${projects.length} total.` : ""
          }`}
          actions={
            canCreateProject(user) && (
              <Button icon={FolderPlus} onClick={() => navigate("/projects/new")}>
                Create Project
              </Button>
            )
          }
        />

        {loading && <Spinner label="Loading projects..." />}

        {!loading && error && <ErrorState message={error} onRetry={fetchProjects} />}

        {!loading && !error && projects.length === 0 && (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet."
            description="Create your first project to start organizing your team's work."
          />
        )}

        {!loading && !error && projects.length > 0 && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="sm:max-w-xs"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="capitalize">
                    {opt.replace("_", " ")}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All priorities</option>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="capitalize">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {filteredProjects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects match your filters."
                description="Try a different search term, status, or priority."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

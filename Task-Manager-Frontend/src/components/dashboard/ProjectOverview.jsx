import { Link } from "react-router-dom";
import { FolderKanban } from "lucide-react";
import ProjectStatusBadge from "../projects/ProjectStatusBadge.jsx";

const columns = ["Project", "Owner", "Status", "Progress", "Updated"];
const PREVIEW_COUNT = 5;

function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Progress mirrors the Project Details / Projects overview calculation:
// share of the project's tasks that are completed.
function projectProgress(projectId, tasks) {
  const projectTasks = tasks.filter((task) => task.project_id === projectId);
  if (projectTasks.length === 0) return null;
  const done = projectTasks.filter((task) => task.status === "completed").length;
  return Math.round((done / projectTasks.length) * 100);
}

function ownerName(project, members) {
  const owner = members.find((member) => member.id === project.created_by);
  if (!owner) return "--";
  return `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() || "--";
}

export default function ProjectOverview({
  projects = [],
  tasks = [],
  members = [],
  loading = false,
  error = "",
}) {
  // Backend already returns projects newest-first, so just take the head.
  const preview = projects.slice(0, PREVIEW_COUNT);

  return (
    <section className="rounded-xl border-[0.5px] border-hair bg-surface-1">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-txt-primary">Recent projects</h2>
        <Link
          to="/projects"
          className="text-[11px] font-medium text-accentblue hover:text-accentblue-icon"
        >
          View all
        </Link>
      </div>

      <div className="hidden grid-cols-5 gap-4 border-t-[0.5px] border-hair px-4 py-2 xl:grid">
        {columns.map((col) => (
          <span
            key={col}
            className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-txt-muted"
          >
            {col}
          </span>
        ))}
      </div>

      {loading && (
        <p className="border-t-[0.5px] border-hair px-4 py-10 text-center text-sm text-txt-muted">
          Loading projects…
        </p>
      )}

      {!loading && error && (
        <p className="border-t-[0.5px] border-hair px-4 py-10 text-center text-sm text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && preview.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 border-t-[0.5px] border-hair px-6 py-14 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-txt-muted">
            <FolderKanban size={18} />
          </span>
          <p className="text-sm text-txt-muted">No projects — create one to begin</p>
        </div>
      )}

      {!loading && !error && preview.length > 0 && (
        <ul className="divide-y-[0.5px] divide-hair border-t-[0.5px] border-hair">
          {preview.map((project) => {
            const progress = projectProgress(project.id, tasks);
            return (
              <li
                key={project.id}
                className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3 text-sm xl:grid-cols-5 xl:items-center"
              >
                <Link
                  to={`/projects/${project.id}`}
                  className="col-span-2 truncate font-medium text-txt-primary hover:text-accentblue xl:col-span-1"
                >
                  {project.name}
                </Link>
                <span className="truncate text-txt-muted">
                  {ownerName(project, members)}
                </span>
                <span>
                  <ProjectStatusBadge status={project.status} />
                </span>
                <span className="text-txt-muted">
                  {progress === null ? "--" : `${progress}%`}
                </span>
                <span className="text-txt-muted">
                  {formatDate(project.updated_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

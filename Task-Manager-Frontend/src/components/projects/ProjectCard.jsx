import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import ProjectStatusBadge from "./ProjectStatusBadge.jsx";
import ProjectPriorityBadge from "./ProjectPriorityBadge.jsx";

function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ProjectCard({ project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex flex-col gap-3 rounded-xl border border-hair bg-surface-1 p-5 transition-colors hover:border-accentblue/50 hover:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-txt-primary">{project.name}</h3>
        <ProjectPriorityBadge priority={project.priority} />
      </div>

      <p className="line-clamp-2 text-sm text-txt-muted">
        {project.description || "No description provided."}
      </p>

      <div className="mt-1 flex items-center justify-between">
        <ProjectStatusBadge status={project.status} />
        <span className="flex items-center gap-1 text-xs text-txt-muted">
          <Calendar size={13} />
          {formatDate(project.due_date)}
        </span>
      </div>
    </Link>
  );
}

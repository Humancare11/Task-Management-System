import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

const PREVIEW_COUNT = 6;

function formatWhen(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RecentActivity({ items = [], loading = false, error = "" }) {
  const preview = items.slice(0, PREVIEW_COUNT);

  return (
    <section className="flex flex-col rounded-xl border-[0.5px] border-hair bg-surface-1">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-txt-primary">Recent activity</h2>
        <Link
          to="/activity"
          className="text-[11px] font-medium text-accentblue hover:text-accentblue-icon"
        >
          View all
        </Link>
      </div>

      {loading && (
        <p className="flex-1 border-t-[0.5px] border-hair px-4 py-10 text-center text-sm text-txt-muted">
          Loading activity…
        </p>
      )}

      {!loading && error && (
        <p className="flex-1 border-t-[0.5px] border-hair px-4 py-10 text-center text-sm text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && preview.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border-t-[0.5px] border-hair px-6 py-14 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-txt-muted">
            <Activity size={18} />
          </span>
          <p className="text-sm text-txt-muted">No recent activity yet</p>
        </div>
      )}

      {!loading && !error && preview.length > 0 && (
        <ul className="flex-1 divide-y-[0.5px] divide-hair border-t-[0.5px] border-hair">
          {preview.map((item) => {
            const linkable = item.project_id && item.task_id;
            const row = (
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accentblue" />
                <div className="min-w-0">
                  <p className="text-sm text-txt-primary">{item.message}</p>
                  <p className="mt-0.5 text-xs text-txt-muted">
                    {formatWhen(item.created_at)}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={item.id}>
                {linkable ? (
                  <Link
                    to={`/projects/${item.project_id}/tasks/${item.task_id}`}
                    className="block hover:bg-surface-2"
                  >
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

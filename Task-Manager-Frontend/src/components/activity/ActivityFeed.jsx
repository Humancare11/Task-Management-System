import { Activity as ActivityIcon } from "lucide-react";
import EmptyState from "../common/EmptyState.jsx";
import ErrorState from "../common/ErrorState.jsx";
import Button from "../ui/Button.jsx";
import ActivityRow from "./ActivityRow.jsx";

export function ActivitySkeleton() {
  return (
    <div className="divide-y-[0.5px] divide-hair rounded-xl border border-hair bg-surface-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-start gap-3 px-4 py-4">
          <span className="h-9 w-9 shrink-0 rounded-full bg-surface-2" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-surface-2" />
            <div className="h-3 w-1/3 rounded bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Purely presentational activity feed. Shared by the global Activity page and
 * the Project / Task contextual Activity tabs. It never performs API requests —
 * the parent owns fetching, pagination state and retry.
 */
export default function ActivityFeed({
  items = [],
  loading = false,
  error = "",
  onRetry,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  loadMoreError = "",
  emptyDescription = "Recent actions will appear here.",
}) {
  if (loading) {
    return <ActivitySkeleton />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activity available."
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y-[0.5px] divide-hair rounded-xl border border-hair bg-surface-1">
        {items.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </ul>

      {hasMore && (
        <div className="flex flex-col items-center gap-2">
          {loadMoreError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {loadMoreError}
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore
              ? "Loading…"
              : loadMoreError
                ? "Try again"
                : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

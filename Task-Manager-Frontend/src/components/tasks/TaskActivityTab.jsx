import { useCallback, useEffect, useRef, useState } from "react";
import ActivityFeed from "../activity/ActivityFeed.jsx";
import { useActivitySocket } from "../activity/useActivitySocket.js";
import {
  prependActivity,
  mergePage1,
  appendPage,
} from "../activity/activityListUtils.js";
import { listTaskActivities } from "../../api/activities.js";

const PAGE_SIZE = 20;

// Contextual activity feed for a single task (GET /api/activities?task_id=).
// Replaces the old, dead `task.activity` rendering in TaskDetails.
export default function TaskActivityTab({ taskId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [loadMoreError, setLoadMoreError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Guard against overlapping requests (e.g. double-clicking "Load more").
  const inFlight = useRef(false);

  const fetchPage = useCallback(
    async (nextPage) => {
      if (inFlight.current || !taskId) return;
      inFlight.current = true;

      if (nextPage === 1) {
        setLoading(true);
        setError("");
      } else {
        setLoadingMore(true);
        setLoadMoreError("");
      }

      try {
        const res = await listTaskActivities(taskId, {
          page: nextPage,
          limit: PAGE_SIZE,
        });
        const rows = res.data.activities ?? [];
        const pagination = res.data.pagination ?? {};

        setItems((prev) =>
          nextPage === 1 ? mergePage1(prev, rows) : appendPage(prev, rows)
        );
        setPage(pagination.page ?? nextPage);
        setTotalPages(pagination.total_pages ?? 1);
      } catch (err) {
        console.error("Failed to load task activity:", err);
        const msg =
          err.response?.data?.message ||
          "Something went wrong while loading this task's activity.";
        if (nextPage === 1) setError(msg);
        else setLoadMoreError(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        inFlight.current = false;
      }
    },
    [taskId]
  );

  // Reset and refetch whenever the task changes.
  useEffect(() => {
    setItems([]);
    setPage(1);
    setTotalPages(1);
    setError("");
    setLoadMoreError("");
    fetchPage(1);
  }, [taskId, fetchPage]);

  // Live updates — only activities belonging to this task.
  useActivitySocket({
    taskId,
    onActivity: useCallback(
      (activity) => setItems((prev) => prependActivity(prev, activity)),
      []
    ),
  });

  const hasMore = page < totalPages;

  return (
    <ActivityFeed
      items={items}
      loading={loading}
      error={error}
      onRetry={() => fetchPage(1)}
      hasMore={hasMore}
      onLoadMore={() => fetchPage(page + 1)}
      loadingMore={loadingMore}
      loadMoreError={loadMoreError}
      emptyDescription="Actions taken on this task will appear here."
    />
  );
}

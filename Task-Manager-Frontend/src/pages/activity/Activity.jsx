import { useCallback, useEffect, useState } from "react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import ActivityFeed from "../../components/activity/ActivityFeed.jsx";
import { useActivitySocket } from "../../components/activity/useActivitySocket.js";
import {
  prependActivity,
  mergePage1,
} from "../../components/activity/activityListUtils.js";
import { listActivities } from "../../api/activities.js";

export default function Activity() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listActivities();
      const rows = res.data.activities ?? [];
      // Keep any live activities that arrived while the request was in flight.
      setActivities((prev) => mergePage1(prev, rows));
    } catch (err) {
      console.error("Failed to load activity feed:", err);
      setError(
        err.response?.data?.message ||
          "Something went wrong while loading the activity feed."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useActivitySocket({
    onActivity: useCallback(
      (activity) => setActivities((prev) => prependActivity(prev, activity)),
      []
    ),
  });

  return (
    <AppLayout title="Activity">
      <div className="space-y-6">
        <PageHeader
          title="Activity"
          description="A timeline of actions taken across your organization."
        />

        <ActivityFeed
          items={activities}
          loading={loading}
          error={error}
          onRetry={fetchActivities}
          emptyDescription="Recent actions across your organization will appear here."
        />
      </div>
    </AppLayout>
  );
}

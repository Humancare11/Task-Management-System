import { useEffect, useMemo, useState } from "react";
import { Monitor as MonitorIcon, RefreshCw, UserPlus } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import { listMonitoringActivities } from "../../api/monitoring.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { canManageInvitations } from "../../config/permissions.js";
import EnrollEmployeeModal from "./EnrollEmployeeModal.jsx";
import MonitoringSummary from "./MonitoringSummary.jsx";
import MonitoringFilters from "./MonitoringFilters.jsx";
import MonitoringCard from "./MonitoringCard.jsx";
import MonitoringDrawer from "./MonitoringDrawer.jsx";
import MonitoringSkeleton from "./MonitoringSkeleton.jsx";
import {
  employeeName,
  groupByEmployee,
  summarise,
} from "./monitoringUtils.js";

export default function Monitoring() {
  const { user } = useAuth();
  const canEnroll = canManageInvitations(user);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [memberFilter, setMemberFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  // Member options accumulate across every response so the select stays stable
  // even after a filter narrows the returned rows.
  const [employees, setEmployees] = useState([]);

  const [selectedUserId, setSelectedUserId] = useState(null);

  function buildParams() {
    const params = {};
    if (memberFilter !== "all") params.user_id = memberFilter;
    if (typeFilter !== "all") params.activity_type = typeFilter;
    if (fromFilter) params.from = new Date(fromFilter).toISOString();
    if (toFilter) params.to = new Date(toFilter).toISOString();
    return params;
  }

  function fetchActivities({ isRefresh = false } = {}) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    listMonitoringActivities(buildParams())
      .then((res) => {
        const list = res.data.activities || [];
        setActivities(list);
        setEmployees((prev) => {
          const map = new Map(prev.map((e) => [e.id, e]));
          list.forEach((item) => {
            if (item.user && !map.has(item.user.id)) {
              map.set(item.user.id, {
                id: item.user.id,
                name: employeeName(item.user),
              });
            }
          });
          return Array.from(map.values()).sort((a, b) =>
            a.name.localeCompare(b.name),
          );
        });
      })
      .catch((err) => {
        setError(
          err.response?.data?.message || "Unable to load monitoring data.",
        );
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }

  useEffect(() => {
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberFilter, typeFilter, fromFilter, toFilter]);

  const groups = useMemo(() => groupByEmployee(activities), [activities]);
  const summary = useMemo(
    () => summarise(groups, activities),
    [groups, activities],
  );

  const selectedGroup = useMemo(
    () => groups.find((g) => String(g.userId) === String(selectedUserId)) || null,
    [groups, selectedUserId],
  );

  function clearFilters() {
    setMemberFilter("all");
    setTypeFilter("all");
    setFromFilter("");
    setToFilter("");
  }

  return (
    <AppLayout title="Monitoring">
      <div className="space-y-6">
        <PageHeader
          title="Monitoring"
          description="Monitor team activity and review available monitoring sessions."
          actions={
            <div className="flex items-center gap-2">
              {canEnroll && (
                <Button icon={UserPlus} onClick={() => setEnrollOpen(true)}>
                  Add Employee
                </Button>
              )}
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={() => fetchActivities({ isRefresh: true })}
                disabled={loading || refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          }
        />

        {canEnroll && (
          <EnrollEmployeeModal
            open={enrollOpen}
            onClose={() => setEnrollOpen(false)}
            onEnrolled={() => fetchActivities({ isRefresh: true })}
          />
        )}

        {loading ? (
          <MonitoringSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchActivities()} />
        ) : (
          <>
            <MonitoringSummary summary={summary} />

            <MonitoringFilters
              employees={employees}
              memberFilter={memberFilter}
              onMemberFilter={setMemberFilter}
              typeFilter={typeFilter}
              onTypeFilter={setTypeFilter}
              fromFilter={fromFilter}
              onFromFilter={setFromFilter}
              toFilter={toFilter}
              onToFilter={setToFilter}
              onClear={clearFilters}
            />

            {groups.length === 0 ? (
              <EmptyState
                icon={MonitorIcon}
                title="No monitoring activity"
                description="Monitoring activity will appear here when the desktop agent submits data for your organization."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {groups.map((group) => (
                  <MonitoringCard
                    key={group.userId}
                    group={group}
                    onOpen={() => setSelectedUserId(group.userId)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <MonitoringDrawer
          group={selectedGroup}
          onClose={() => setSelectedUserId(null)}
        />
      </div>
    </AppLayout>
  );
}

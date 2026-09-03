import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Monitor as MonitorIcon,
  RefreshCw,
  UserPlus,
  MonitorSmartphone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import { getMonitoringSummary } from "../../api/monitoring.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { canManageInvitations } from "../../config/permissions.js";
import EnrollEmployeeModal from "./EnrollEmployeeModal.jsx";
import ManageDevicesModal from "./ManageDevicesModal.jsx";
import MonitoringCard from "./MonitoringCard.jsx";
import MonitoringSkeleton from "./MonitoringSkeleton.jsx";
import {
  employeeName,
  formatHm,
  formatIsoDateLong,
  isoDate,
  shiftIsoDate,
} from "./monitoringUtils.js";

function DayTotals({ summaries }) {
  const totals = useMemo(() => {
    const t = { employees: summaries.length, active: 0, span: 0, idle: 0, screenOff: 0 };
    for (const s of summaries) {
      t.active += s.active_seconds || 0;
      t.span += s.span_seconds || 0;
      t.idle += s.idle_seconds || 0;
      t.screenOff += s.screen_off_seconds || 0;
    }
    return t;
  }, [summaries]);

  const Tile = ({ label, value }) => (
    <div className="rounded-xl border border-hair bg-surface-1 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-txt-muted">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-display font-bold text-txt-primary">{value}</p>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <Tile label="Employees" value={totals.employees} />
      <Tile label="Total session" value={formatHm(totals.span)} />
      <Tile label="Active" value={formatHm(totals.active)} />
      <Tile label="Idle" value={formatHm(totals.idle)} />
      <Tile label="Screen off" value={formatHm(totals.screenOff)} />
    </div>
  );
}

export default function Monitoring() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEnroll = canManageInvitations(user);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [date, setDate] = useState(isoDate());
  const [memberFilter, setMemberFilter] = useState("all");

  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchSummary = useCallback(
    ({ isRefresh = false } = {}) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      getMonitoringSummary({ from: date, to: date, page_size: 200 })
        .then((res) => setSummaries(res.data.summaries || []))
        .catch((err) =>
          setError(err.response?.data?.message || "Unable to load monitoring data."),
        )
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [date],
  );

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const members = useMemo(() => {
    const map = new Map();
    for (const s of summaries) {
      if (s.user && !map.has(s.user.id)) {
        map.set(s.user.id, { id: s.user.id, name: employeeName(s.user) });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [summaries]);

  const visible = useMemo(
    () =>
      memberFilter === "all"
        ? summaries
        : summaries.filter((s) => String(s.user_id) === String(memberFilter)),
    [summaries, memberFilter],
  );

  const isToday = date >= isoDate();

  return (
    <AppLayout title="Monitoring">
      <div className="space-y-6">
        <PageHeader
          title="Monitoring"
          description="Daily activity per employee, derived from the desktop agent."
          actions={
            <div className="flex items-center gap-2">
              {canEnroll && (
                <>
                  <Button icon={UserPlus} onClick={() => setEnrollOpen(true)}>
                    Add Employee
                  </Button>
                  <Button
                    variant="secondary"
                    icon={MonitorSmartphone}
                    onClick={() => setDevicesOpen(true)}
                  >
                    Manage Devices
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={() => fetchSummary({ isRefresh: true })}
                disabled={loading || refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          }
        />

        {canEnroll && (
          <>
            <EnrollEmployeeModal
              open={enrollOpen}
              onClose={() => setEnrollOpen(false)}
              onEnrolled={() => fetchSummary({ isRefresh: true })}
            />
            <ManageDevicesModal
              open={devicesOpen}
              onClose={() => setDevicesOpen(false)}
              onChanged={() => fetchSummary({ isRefresh: true })}
            />
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-hair bg-surface-1 p-4">
          <div className="flex items-center rounded-lg border border-hair">
            <button
              type="button"
              aria-label="Previous day"
              className="p-2 text-txt-muted hover:text-txt-primary"
              onClick={() => setDate((d) => shiftIsoDate(d, -1))}
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={date}
              max={isoDate()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="border-x border-hair bg-transparent px-2 py-1.5 text-xs text-txt-primary focus:outline-none"
            />
            <button
              type="button"
              aria-label="Next day"
              disabled={isToday}
              className="p-2 text-txt-muted hover:text-txt-primary disabled:opacity-40"
              onClick={() => setDate((d) => shiftIsoDate(d, 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <span className="text-sm text-txt-muted">{formatIsoDateLong(date)}</span>

          <label className="ml-auto flex items-center gap-2 text-xs text-txt-muted">
            Member
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue"
            >
              <option value="all">All members</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <MonitoringSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchSummary()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={MonitorIcon}
            title="No monitoring activity"
            description={`No agent data for ${formatIsoDateLong(date)}. Data appears here once the desktop agent has reported for the day.`}
          />
        ) : (
          <>
            <DayTotals summaries={visible} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((s) => (
                <MonitoringCard
                  key={`${s.user_id}-${s.local_date}`}
                  summary={s}
                  onOpen={() => navigate(`/monitoring/${s.user_id}?date=${date}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

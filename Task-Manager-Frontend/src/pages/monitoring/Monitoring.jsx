import { useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  AppWindow,
  Globe,
  Moon,
  Monitor as MonitorIcon,
  RefreshCw,
  Timer,
  UserPlus,
} from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import { listMonitoringActivities } from "../../api/monitoring.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { canManageInvitations } from "../../config/permissions.js";
import EnrollEmployeeModal from "./EnrollEmployeeModal.jsx";

const ACTIVITY_TYPES = ["application", "website", "idle"];

const selectClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";

const TYPE_META = {
  application: { label: "Application", icon: AppWindow, tone: "bg-primary-50 text-primary-600" },
  website: { label: "Website", icon: Globe, tone: "bg-sky-50 text-sky-600" },
  idle: { label: "Idle", icon: Moon, tone: "bg-slate-100 text-slate-500" },
};

function employeeName(user) {
  if (!user) return "Unknown employee";
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return name || user.email || "Unknown employee";
}

function formatClock(value) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value) {
  if (!value) return "--";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds) {
  const total = Number(seconds) || 0;
  if (total < 60) return `${total} sec`;
  const mins = Math.floor(total / 60);
  const rem = total % 60;
  if (mins < 60) return rem ? `${mins} min ${rem} sec` : `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hours} hr ${remMins} min` : `${hours} hr`;
}

function SummaryCard({ icon: Icon, tone, value, label }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-ink">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function Monitoring() {
  const { user } = useAuth();
  const canEnroll = canManageInvitations(user);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  // Employee options accumulate from every activity we have seen.
  const [employees, setEmployees] = useState([]);

  function buildParams() {
    const params = {};
    if (employeeFilter !== "all") params.user_id = employeeFilter;
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
          return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
        });
      })
      .catch((err) => {
        setError(
          err.response?.data?.message || "Failed to load monitoring activities.",
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
  }, [employeeFilter, typeFilter, fromFilter, toFilter]);

  const summary = useMemo(() => {
    const s = {
      total: activities.length,
      activeSeconds: 0,
      idleSeconds: 0,
      applications: 0,
      websites: 0,
    };
    activities.forEach((a) => {
      const secs = Number(a.duration_seconds) || 0;
      if (a.activity_type === "idle") {
        s.idleSeconds += secs;
      } else {
        s.activeSeconds += secs;
      }
      if (a.activity_type === "application") s.applications += 1;
      if (a.activity_type === "website") s.websites += 1;
    });
    return s;
  }, [activities]);

  return (
    <AppLayout title="Monitoring">
      <div className="space-y-6">
        <PageHeader
          title="Monitoring"
          description="Employee activity overview — collected from the desktop monitoring agent."
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

        {loading && <Spinner label="Loading monitoring activities..." />}

        {!loading && error && (
          <ErrorState message={error} onRetry={() => fetchActivities()} />
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryCard icon={ActivityIcon} tone="bg-primary-50 text-primary-600" value={summary.total} label="Total Activities" />
              <SummaryCard icon={Timer} tone="bg-emerald-50 text-emerald-600" value={formatDuration(summary.activeSeconds)} label="Active Time" />
              <SummaryCard icon={Moon} tone="bg-slate-100 text-slate-500" value={formatDuration(summary.idleSeconds)} label="Idle Time" />
              <SummaryCard icon={AppWindow} tone="bg-sky-50 text-sky-600" value={summary.applications} label="Applications" />
              <SummaryCard icon={Globe} tone="bg-amber-50 text-amber-600" value={summary.websites} label="Websites" />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All activity types</option>
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {TYPE_META[t].label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                From
                <input
                  type="datetime-local"
                  value={fromFilter}
                  onChange={(e) => setFromFilter(e.target.value)}
                  className={selectClass}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                To
                <input
                  type="datetime-local"
                  value={toFilter}
                  onChange={(e) => setToFilter(e.target.value)}
                  className={selectClass}
                />
              </label>
              {(employeeFilter !== "all" ||
                typeFilter !== "all" ||
                fromFilter ||
                toFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setEmployeeFilter("all");
                    setTypeFilter("all");
                    setFromFilter("");
                    setToFilter("");
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-primary-600"
                >
                  Clear filters
                </button>
              )}
            </div>

            {activities.length === 0 ? (
              <EmptyState
                icon={MonitorIcon}
                title="No monitoring activity recorded yet."
                description="Activity submitted by the monitoring agent will appear here. Submit an activity and click Refresh."
              />
            ) : (
              <ol className="relative space-y-4 border-l border-slate-200 pl-6">
                {activities.map((item) => {
                  const meta = TYPE_META[item.activity_type] || TYPE_META.idle;
                  const Icon = meta.icon;
                  return (
                    <li key={item.id} className="relative">
                      <span
                        className={`absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${meta.tone}`}
                      >
                        <Icon size={13} />
                      </span>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">
                            {employeeName(item.user)}
                            {item.agent?.device_name && (
                              <span className="ml-2 text-xs font-normal text-slate-400">
                                {item.agent.device_name}
                              </span>
                            )}
                          </p>
                          <span className="text-xs text-slate-400">
                            {formatClock(item.started_at)} – {formatClock(item.ended_at)}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.tone}`}>
                            {meta.label}
                          </span>
                          {item.application_name && (
                            <span className="text-ink">· {item.application_name}</span>
                          )}
                        </div>

                        {item.window_title && (
                          <p className="mt-1 truncate text-sm text-slate-500">
                            {item.window_title}
                          </p>
                        )}
                        {item.domain && (
                          <p className="mt-0.5 text-xs text-sky-600">{item.domain}</p>
                        )}

                        <p className="mt-2 text-xs text-slate-400">
                          {formatDuration(item.duration_seconds)} · {formatDateTime(item.started_at)}
                          {" – "}
                          {formatDateTime(item.ended_at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

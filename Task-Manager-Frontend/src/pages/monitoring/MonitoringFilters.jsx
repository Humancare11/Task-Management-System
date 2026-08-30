import { Info } from "lucide-react";
import { ACTIVITY_TYPES, TYPE_META } from "./monitoringUtils.js";

const controlClass =
  "rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue disabled:cursor-not-allowed disabled:opacity-50";

export default function MonitoringFilters({
  employees,
  memberFilter,
  onMemberFilter,
  typeFilter,
  onTypeFilter,
  fromFilter,
  onFromFilter,
  toFilter,
  onToFilter,
  onClear,
}) {
  const hasActiveFilter =
    memberFilter !== "all" || typeFilter !== "all" || fromFilter || toFilter;

  return (
    <div className="rounded-xl border border-hair bg-surface-1 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        {/* Project filtering is disabled: monitoring data has no project link. */}
        <label className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs font-medium text-txt-muted">
            Project
            <Info size={12} />
          </span>
          <select
            className={controlClass}
            disabled
            title="Project filtering will be available in a future update."
          >
            <option>All Projects</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-txt-muted">Member</span>
          <select
            className={controlClass}
            value={memberFilter}
            onChange={(e) => onMemberFilter(e.target.value)}
          >
            <option value="all">All Members</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-txt-muted">Activity type</span>
          <select
            className={controlClass}
            value={typeFilter}
            onChange={(e) => onTypeFilter(e.target.value)}
          >
            <option value="all">All activity</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_META[t].label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-txt-muted">From</span>
          <input
            type="datetime-local"
            className={controlClass}
            value={fromFilter}
            onChange={(e) => onFromFilter(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-txt-muted">To</span>
          <input
            type="datetime-local"
            className={controlClass}
            value={toFilter}
            onChange={(e) => onToFilter(e.target.value)}
          />
        </label>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={onClear}
            className="pb-2 text-xs font-medium text-txt-muted hover:text-accentblue"
          >
            Clear filters
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-txt-muted">
        Project filtering will be available in a future update.
      </p>
    </div>
  );
}

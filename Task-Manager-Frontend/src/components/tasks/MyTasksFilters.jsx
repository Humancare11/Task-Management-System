import SearchInput from "../ui/SearchInput.jsx";
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  STATUS_LABELS,
} from "../../pages/tasks/myTasksUtils.js";

const selectClass =
  "rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue disabled:cursor-not-allowed disabled:opacity-50";

// All filtering is client-side against the already-fetched My Tasks list —
// `GET /projects/my-tasks` takes no query params.
export default function MyTasksFilters({
  search,
  onSearch,
  projects,
  projectFilter,
  onProjectFilter,
  priorityFilter,
  onPriorityFilter,
  statusTab,
  onStatusTab,
  onClear,
  hasActiveFilter,
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search my tasks..."
          className="lg:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          <select
            className={selectClass}
            value={projectFilter}
            onChange={(e) => onProjectFilter(e.target.value)}
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={priorityFilter}
            onChange={(e) => onPriorityFilter(e.target.value)}
          >
            <option value="all">All priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p} className="capitalize">
                {p[0].toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-txt-muted hover:text-accentblue"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-hair">
        {[{ key: "all", label: "All" }, ...STATUS_OPTIONS.map((s) => ({ key: s, label: STATUS_LABELS[s] }))].map(
          (tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onStatusTab(tab.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                statusTab === tab.key
                  ? "border-accentblue text-txt-primary"
                  : "border-transparent text-txt-muted hover:text-txt-primary"
              }`}
            >
              {tab.label}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

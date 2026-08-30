import { NavLink, Link } from "react-router-dom";
import { X, LayoutGrid, Plus, ChevronDown } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { navigationGroups } from "../../config/navigation.js";
import { canCreateProject } from "../../config/permissions.js";
import UserMenu from "./UserMenu.jsx";

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();

  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(user?.role)),
    }))
    .filter((group) => group.items.length > 0);

  // Flattened list for the icon rail, with a divider flag between groups.
  const railItems = visibleGroups.flatMap((group, groupIndex) =>
    group.items.map((item, itemIndex) => ({
      ...item,
      dividerBefore: groupIndex > 0 && itemIndex === 0,
    })),
  );

  const railLinkClass = ({ isActive }) =>
    `flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
      isActive
        ? "bg-accentblue-soft text-accentblue"
        : "text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
    }`;

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] transition-colors ${
      isActive
        ? "bg-accentblue text-white"
        : "text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
    }`;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 flex transform transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Icon-only nav rail */}
        <div className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-hair bg-rail py-3">
          <Link
            to="/dashboard"
            onClick={onClose}
            className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-accentblue text-white"
            aria-label="Home"
          >
            <LayoutGrid size={17} />
          </Link>

          <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto">
            {railItems.map((item) => (
              <div key={`rail-${item.path}`} className="flex flex-col items-center">
                {item.dividerBefore && (
                  <span className="my-1 h-px w-6 bg-hair" aria-hidden="true" />
                )}
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  title={item.label}
                  aria-label={item.label}
                  className={railLinkClass}
                >
                  <item.icon size={17} />
                </NavLink>
              </div>
            ))}
          </nav>

          <div className="mt-1 border-t border-hair pt-2">
            <UserMenu compact />
          </div>
        </div>

        {/* Full sidebar */}
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-hair bg-surface-1 text-txt-primary">
          <div className="flex items-start justify-between gap-2 px-4 py-4">
            <button
              type="button"
              className="flex min-w-0 items-center gap-2 text-left"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-sm font-semibold text-txt-primary">
                  <span className="truncate">
                    {user?.first_name ? `${user.first_name}'s Workspace` : "Workspace"}
                  </span>
                  <ChevronDown size={14} className="shrink-0 text-txt-muted" />
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-txt-muted">
                  Humancare Connect
                </span>
              </span>
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-txt-muted hover:bg-surface-2 hover:text-txt-primary lg:hidden"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
            {visibleGroups.map((group) => (
              <div key={group.title}>
                <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-txt-muted">
                  {group.title}
                </p>
                <div className="mt-1.5 flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={navLinkClass}
                    >
                      <item.icon size={15} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {canCreateProject(user) && (
            <div className="border-t border-hair p-3">
              <Link
                to="/projects?create=1"
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-lg bg-accentblue px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-accentblue-hover"
              >
                <Plus size={15} />
                Create project
              </Link>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

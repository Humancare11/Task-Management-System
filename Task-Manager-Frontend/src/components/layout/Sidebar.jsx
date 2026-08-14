import { useState } from "react";
import { NavLink } from "react-router-dom";
import { X, LayoutGrid, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { navigationGroups } from "../../config/navigation.js";

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col transform bg-ink text-white transition-all duration-200 ease-in-out lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[76px]" : "w-64 lg:w-64"}`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white">
              <LayoutGrid size={18} />
            </span>
            {!collapsed && (
              <span className="truncate font-display text-base font-bold">
                Humancare Connect
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-2 flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-4">
          {navigationGroups.map((group) => {
            const items = group.items.filter((item) =>
              item.roles.includes(user?.role),
            );
            if (items.length === 0) return null;

            return (
              <div key={group.title}>
                {!collapsed && (
                  <p className="px-3 text-xs font-semibold tracking-wider text-white/40">
                    {group.title}
                  </p>
                )}
                <div className="mt-2 flex flex-col gap-1">
                  {items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-primary-600/90 text-white"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        } ${collapsed ? "lg:justify-center" : ""}`
                      }
                    >
                      <item.icon size={18} className="shrink-0" />
                      {!collapsed && item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed((v) => !v)}
          className="hidden items-center gap-2 border-t border-white/10 px-4 py-3 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white lg:flex"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && "Collapse"}
        </button>
      </aside>
    </>
  );
}

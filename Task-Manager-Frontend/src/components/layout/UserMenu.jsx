import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import Avatar from "../ui/Avatar.jsx";

export default function UserMenu({ compact = false }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (compact) {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
          aria-label="Account menu"
        >
          <Avatar firstName={user?.first_name} lastName={user?.last_name} size="sm" />
        </button>

        {open && (
          <div className="absolute bottom-0 left-full ml-2 w-44 rounded-lg border border-hair bg-surface-2 py-1 shadow-lg">
            <div className="border-b border-hair px-3 py-2">
              <span className="block truncate text-sm font-medium text-txt-primary">
                {user?.first_name} {user?.last_name}
              </span>
              <span className="block text-xs capitalize text-txt-muted">
                {user?.role}
              </span>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-txt-muted hover:bg-white/5 hover:text-txt-primary"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
      >
        <Avatar firstName={user?.first_name} lastName={user?.last_name} size="sm" />
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium text-ink">{user?.first_name}</span>
          <span className="block text-xs capitalize text-slate-500">{user?.role}</span>
        </span>
        <ChevronDown size={16} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

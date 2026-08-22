import { Menu } from "lucide-react";
import SearchInput from "../ui/SearchInput.jsx";
import UserMenu from "./UserMenu.jsx";
import NotificationBell from "./NotificationBell.jsx";

export default function Topbar({ title, onMenuClick }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="truncate text-lg font-display font-bold text-ink">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <SearchInput
          placeholder="Search..."
          className="hidden w-64 md:block"
          disabled
        />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}

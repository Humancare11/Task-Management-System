import { Search } from "lucide-react";

export default function SearchInput({
  value = "",
  onChange,
  placeholder = "Search...",
  disabled = false,
  className = "",
}) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-hair bg-surface-1 py-2 pl-9 pr-3 text-sm text-txt-primary placeholder:text-txt-muted focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-txt-muted"
      />
    </div>
  );
}

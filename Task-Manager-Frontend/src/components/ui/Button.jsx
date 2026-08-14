const variants = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 disabled:bg-primary-300",
  secondary:
    "border border-slate-200 bg-white text-ink hover:bg-slate-50 disabled:text-slate-400 disabled:hover:bg-white",
  ghost:
    "text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent",
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  className = "",
  children,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

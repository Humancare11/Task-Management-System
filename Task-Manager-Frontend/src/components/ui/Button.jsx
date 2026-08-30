const variants = {
  primary:
    "bg-accentblue text-white hover:bg-accentblue-hover disabled:bg-accentblue/50",
  secondary:
    "border border-hair bg-surface-1 text-txt-primary hover:bg-surface-2 disabled:text-txt-muted disabled:hover:bg-surface-1",
  ghost:
    "text-txt-muted hover:bg-surface-2 hover:text-txt-primary disabled:text-txt-muted disabled:hover:bg-transparent",
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50",
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

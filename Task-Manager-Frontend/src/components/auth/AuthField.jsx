import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-hair bg-surface-1 px-3 py-2.5 text-sm text-txt-primary placeholder:text-txt-muted focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue transition-colors";

// Token-styled auth input. Adds an optional password visibility toggle without
// changing the underlying field name/value/validation behaviour.
export default function AuthField({
  label,
  type = "text",
  name,
  labelRight,
  className = "",
  error,
  ...props
}) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && reveal ? "text" : type;

  return (
    <div className={`mb-4 ${className}`}>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={name} className="text-sm font-medium text-txt-primary">
          {label}
        </label>
        {labelRight}
      </div>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={resolvedType}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          className={`${inputClass} ${isPassword ? "pr-10" : ""} ${
            error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""
          }`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-txt-muted hover:text-txt-primary"
            aria-label={reveal ? "Hide password" : "Show password"}
          >
            {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

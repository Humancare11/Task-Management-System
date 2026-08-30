import { Check, X } from "lucide-react";

// Lightweight password feedback for the auth forms.
//
// The ONLY rule the backend enforces is a minimum length of 8 characters, so
// that is the only pass/fail requirement shown here. The coloured bar is an
// advisory strength hint (uppercase / lowercase / number / symbol) and never
// blocks submission.

export function isPasswordValid(password) {
  return typeof password === "string" && password.length >= 8;
}

function scorePassword(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

const LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const BAR_COLORS = [
  "bg-red-500",
  "bg-red-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-emerald-500",
];

export default function PasswordStrength({ password }) {
  if (!password) return null;

  const meetsLength = password.length >= 8;
  const score = scorePassword(password);

  return (
    <div className="-mt-2 mb-4">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? BAR_COLORS[score] : "bg-hair"
            }`}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span
          className={`inline-flex items-center gap-1 ${
            meetsLength ? "text-emerald-600 dark:text-emerald-400" : "text-txt-muted"
          }`}
        >
          {meetsLength ? <Check size={12} /> : <X size={12} />}
          At least 8 characters
        </span>
        <span className="text-txt-muted">{LABELS[score]}</span>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { CheckSquare } from "lucide-react";

// Shared two-column shell for the Login and Register pages. Presentation only —
// each page keeps its own form state, validation, API calls and redirects.
// (AcceptInvitation still uses the older AuthLayout and is intentionally untouched.)

const HIGHLIGHTS = [
  "Projects, tasks and deadlines in one organized workspace",
  "Team collaboration, questions and discussions",
  "Activity and monitoring to keep work on track",
];

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen bg-page lg:grid-cols-[1.05fr_1fr]">
      {/* Left: brand + value panel */}
      <aside className="relative hidden flex-col justify-between border-r border-hair bg-surface-1 p-10 lg:flex xl:p-14">
        <Link to="/" className="inline-flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accentblue text-white">
            <CheckSquare size={18} />
          </span>
          <span className="font-display text-lg font-bold text-txt-primary">
            Humancare Connect
          </span>
        </Link>

        <div className="max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight text-txt-primary">
            The workspace for your team&apos;s projects and tasks.
          </h2>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-txt-muted">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accentblue/15 text-accentblue">
                  <CheckSquare size={12} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-txt-muted">
          &copy; {new Date().getFullYear()} Humancare Connect. All rights reserved.
        </p>
      </aside>

      {/* Right: form */}
      <main className="flex flex-col items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 lg:hidden"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accentblue text-white">
              <CheckSquare size={18} />
            </span>
            <span className="font-display text-lg font-bold text-txt-primary">
              Humancare Connect
            </span>
          </Link>

          <h1 className="font-display text-2xl font-bold text-txt-primary">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-txt-muted">{subtitle}</p>}

          <div className="mt-8">{children}</div>

          {footer && (
            <p className="mt-8 text-center text-sm text-txt-muted">{footer}</p>
          )}
        </div>
      </main>
    </div>
  );
}

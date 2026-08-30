import { Link } from "react-router-dom";
import {
  CheckSquare,
  FolderKanban,
  Users,
  MessagesSquare,
  Activity,
  ArrowRight,
} from "lucide-react";

// Public landing page. Static marketing content only — no API calls, no
// connection to protected data. The workspace preview below is illustrative.

const PREVIEW_STATS = [
  { label: "Active projects", value: "6" },
  { label: "Open tasks", value: "28" },
  { label: "Completed", value: "142" },
];

const PREVIEW_TASKS = [
  { title: "Complete consultation API", project: "Humancare Project", tone: "amber", status: "In progress" },
  { title: "Review onboarding flow", project: "Mobile App", tone: "sky", status: "In review" },
  { title: "Fix validation edge cases", project: "Humancare Project", tone: "emerald", status: "Done" },
];

const PREVIEW_PROJECTS = [
  { name: "Humancare Project", pct: 72 },
  { name: "Mobile App", pct: 45 },
];

const FEATURES = [
  { icon: FolderKanban, title: "Projects & Tasks", desc: "Plan work, assign owners and track progress to done." },
  { icon: Users, title: "Team Collaboration", desc: "Shared projects, roles and members in one workspace." },
  { icon: MessagesSquare, title: "Questions & Discussions", desc: "Keep decisions and context next to the work." },
  { icon: Activity, title: "Activity & Monitoring", desc: "See what changed and where time is going." },
];

const TONE = {
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

function WorkspacePreview() {
  return (
    <div className="rounded-2xl border border-hair bg-surface-1 p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-hair pb-4">
        <div>
          <p className="text-xs text-txt-muted">Workspace / Overview</p>
          <p className="mt-0.5 font-display text-sm font-bold text-txt-primary">
            Good morning, Alex
          </p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accentblue text-xs font-semibold text-white">
          AK
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 py-4">
        {PREVIEW_STATS.map((s) => (
          <div key={s.label} className="rounded-lg bg-surface-2 px-3 py-2.5 text-center">
            <p className="font-display text-lg font-bold text-txt-primary">{s.value}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-txt-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-txt-muted">
        Today&apos;s priorities
      </p>
      <ul className="space-y-2">
        {PREVIEW_TASKS.map((t) => (
          <li
            key={t.title}
            className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-txt-primary">{t.title}</p>
              <p className="text-[11px] text-txt-muted">{t.project}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${TONE[t.tone]}`}>
              {t.status}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-3 border-t border-hair pt-4">
        {PREVIEW_PROJECTS.map((p) => (
          <div key={p.name}>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-medium text-txt-primary">{p.name}</p>
              <p className="text-xs text-txt-muted">{p.pct}%</p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accentblue" style={{ width: `${p.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-page text-txt-primary">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <span className="inline-flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accentblue text-white">
            <CheckSquare size={18} />
          </span>
          <span className="font-display text-lg font-bold">Humancare Connect</span>
        </span>
        <nav className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-txt-muted transition-colors hover:text-txt-primary"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-accentblue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accentblue-hover"
          >
            Get Started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="grid items-center gap-12 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              Plan work.
              <br />
              Manage projects.
              <br />
              <span className="text-accentblue">Get things done.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-txt-muted">
              Bring your projects, tasks, deadlines, team collaboration and
              progress into one organized workspace.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-accentblue px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accentblue-hover"
              >
                Get Started
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-hair bg-surface-1 px-5 py-2.5 text-sm font-medium text-txt-primary transition-colors hover:bg-surface-2"
              >
                Log in
              </Link>
            </div>
          </div>

          <div className="lg:pl-6">
            <WorkspacePreview />
          </div>
        </section>

        <section className="border-t border-hair py-14">
          <h2 className="font-display text-xl font-bold">
            Everything your team needs to stay organized
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-hair bg-surface-1 p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accentblue/15 text-accentblue">
                  <f.icon size={18} />
                </span>
                <p className="mt-3 text-sm font-semibold text-txt-primary">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-txt-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-8 text-xs text-txt-muted sm:px-8">
        &copy; {new Date().getFullYear()} Humancare Connect. All rights reserved.
      </footer>
    </div>
  );
}

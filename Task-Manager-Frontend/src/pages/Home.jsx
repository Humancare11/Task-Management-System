import { Link } from "react-router-dom";

export default function Home() {
  const stats = [
    { value: "24", label: "Total Tasks", accent: false },
    { value: "08", label: "In Progress", accent: false },
    { value: "12", label: "Completed", accent: true },
    { value: "02", label: "Overdue", accent: false },
  ];

  const tasks = [
    {
      title: "Finalize dashboard design",
      meta: "Design",
      tag: "High Priority",
      tagColor: "bg-rose-50 text-rose-600",
      dot: "bg-rose-500",
    },
    {
      title: "Review API integration",
      meta: "Development",
      tag: "In Progress",
      tagColor: "bg-amber-50 text-amber-600",
      dot: "bg-amber-500",
    },
    {
      title: "Team sprint meeting",
      meta: "Meeting",
      tag: "Today",
      tagColor: "bg-blue-50 text-blue-600",
      dot: "bg-blue-500",
    },
    {
      title: "Deploy new update",
      meta: "DevOps",
      tag: "Upcoming",
      tagColor: "bg-slate-100 text-slate-500",
      dot: "bg-slate-400",
    },
  ];

  const projects = [
    { name: "Website Redesign", percent: 75, done: 9, total: 12 },
    { name: "Mobile Application", percent: 60, done: 6, total: 10 },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <style>{`
        @keyframes floatCard {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .float-slow { animation: floatCard 6s ease-in-out infinite; }
        .float-slower { animation: floatCard 7.5s ease-in-out infinite; }
        .fade-up { animation: fadeInUp 0.6s ease-out both; }
        .fade-up-1 { animation-delay: 0.05s; }
        .fade-up-2 { animation-delay: 0.15s; }
        .fade-up-3 { animation-delay: 0.25s; }
        .fade-up-4 { animation-delay: 0.35s; }
        .fade-up-5 { animation-delay: 0.45s; }
      `}</style>

      <header className="flex items-center justify-between px-8 py-5">
        <span className="text-xl font-display font-extrabold text-ink tracking-tight">
          Humancare Connect
        </span>

        <nav className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm font-medium text-ink px-4 py-2 hover:text-accent transition-colors"
          >
            Log in
          </Link>

          <Link
            to="/register"
            className="text-sm font-medium bg-ink text-white px-4 py-2 rounded-lg hover:bg-accent-dark transition-colors"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="relative flex-1 overflow-hidden">
        {/* Background layer */}
        <div className="absolute inset-0 -z-10 bg-slate-50">
          <div className="absolute inset-0 opacity-[0.4] [background-image:linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_20%,transparent_75%)]" />
          <div className="absolute -top-24 -left-24 w-[420px] h-[420px] bg-accent/20 rounded-full blur-[110px]" />
          <div className="absolute top-40 -right-32 w-[480px] h-[480px] bg-indigo-300/20 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-16 items-center">
          {/* LEFT COLUMN */}
          <div>
            <div className="fade-up fade-up-1 inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
              <span>✨</span>
              <span>One workspace for your entire team</span>
            </div>

            <h1 className="fade-up fade-up-2 mt-6 text-5xl md:text-6xl font-display font-extrabold text-ink leading-[1.08] tracking-tight">
              Plan smarter.
              <br />
              <span className="text-accent">Move faster.</span>
              <br />
              Get more done.
            </h1>

            <p className="fade-up fade-up-3 mt-6 text-lg text-slate-500 max-w-md leading-relaxed">
              Bring your projects, tasks, deadlines, and team collaboration
              together in one powerful workspace. Stay organized, focused, and
              always know what comes next.
            </p>

            <div className="fade-up fade-up-4 mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="group inline-flex items-center gap-2 bg-ink text-white font-medium px-6 py-3 rounded-lg shadow-lg shadow-ink/10 hover:bg-accent-dark hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                Start for free
                <span className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>

              <button
                type="button"
                className="inline-flex items-center gap-2 bg-white text-ink font-medium px-6 py-3 rounded-lg border border-slate-200 hover:border-accent hover:text-accent transition-colors"
              >
                Explore workspace
              </button>
            </div>

            <div className="fade-up fade-up-5 mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-emerald-500">✓</span>
                Free to get started
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-emerald-500">✓</span>
                No credit card required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-emerald-500">✓</span>
                Ready in minutes
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN — DASHBOARD */}
          <div className="relative fade-up fade-up-3">
            {/* Floating card 1 */}
            <div className="float-slow hidden md:flex absolute -top-6 -left-6 z-20 items-center gap-3 bg-white rounded-xl border border-slate-200 shadow-lg px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">
                ✓
              </div>
              <div>
                <p className="text-xs font-semibold text-ink leading-tight">
                  Design system
                </p>
                <p className="text-[11px] text-slate-400">Just completed</p>
              </div>
            </div>

            {/* Floating card 2 */}
            <div className="float-slower hidden md:block absolute top-1/2 -right-8 z-20 bg-white rounded-xl border border-slate-200 shadow-lg px-4 py-3">
              <p className="text-[11px] font-medium text-slate-400">
                Team activity
              </p>
              <p className="text-sm font-semibold text-ink">
                +4 tasks completed today
              </p>
            </div>

            {/* Floating card 3 */}
            <div className="float-slow hidden md:flex absolute -bottom-6 left-10 z-20 items-center gap-2 bg-white rounded-xl border border-slate-200 shadow-lg px-4 py-3">
              <span>🔥</span>
              <div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Productivity
                </p>
                <p className="text-sm font-semibold text-emerald-600">
                  +24% this week
                </p>
              </div>
            </div>

            {/* Main dashboard card */}
            <div className="relative z-10 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-300/40 p-6 hover:-translate-y-1 transition-transform duration-500">
              {/* Dashboard header */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Workspace / Overview
                  </p>
                  <p className="mt-1 text-base font-display font-bold text-ink">
                    Good morning, Alex 👋
                  </p>
                  <p className="text-xs text-slate-400">
                    Here's what's happening with your work today.
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-ink text-white flex items-center justify-center text-xs font-semibold shrink-0">
                  AK
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2 py-5">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-lg px-2.5 py-3 text-center ${
                      s.accent ? "bg-accent/10" : "bg-slate-50"
                    }`}
                  >
                    <p
                      className={`text-lg font-display font-bold ${
                        s.accent ? "text-accent" : "text-ink"
                      }`}
                    >
                      {s.value}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Task list */}
              <div className="pt-1">
                <p className="text-[11px] font-semibold tracking-wide text-slate-400 mb-3">
                  TODAY'S PRIORITIES
                </p>
                <ul className="space-y-2.5">
                  {tasks.map((t) => (
                    <li
                      key={t.title}
                      className="flex items-center justify-between gap-3 bg-slate-50 hover:bg-slate-100 rounded-lg px-3 py-2.5 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${t.dot}`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {t.title}
                          </p>
                          <p className="text-[11px] text-slate-400">{t.meta}</p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-medium px-2 py-1 rounded-full whitespace-nowrap shrink-0 ${t.tagColor}`}
                      >
                        {t.tag}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Project progress */}
              <div className="mt-5 pt-5 border-t border-slate-100 space-y-4">
                {projects.map((p) => (
                  <div key={p.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-ink">{p.name}</p>
                      <p className="text-xs text-slate-400">
                        {p.done} / {p.total} tasks
                      </p>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-700"
                        style={{ width: `${p.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import { useAuth } from "../context/AuthContext.jsx";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-200 bg-white">
        <span className="text-lg font-display font-bold text-ink">Flowboard</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">
            {user?.first_name} · {user?.role}
          </span>
          <button
            onClick={logout}
            className="text-sm font-medium text-ink border border-slate-200 px-3.5 py-1.5 rounded-lg hover:border-accent transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="p-8">
        <h1 className="text-2xl font-display font-bold text-ink">
          Welcome, {user?.first_name} 👋
        </h1>
        <p className="mt-2 text-slate-500">
          This is your dashboard shell — projects and task boards get built
          here next.
        </p>
      </main>
    </div>
  );
}

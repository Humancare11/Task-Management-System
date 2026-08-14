import { Link } from "react-router-dom";
import BoardIllustration from "../components/BoardIllustration.jsx";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
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

      <main className="flex-1 flex items-center px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center w-full">
          <div>
            <h1 className="text-5xl font-display font-extrabold text-ink leading-[1.1]">
              Plan the work.
              <br />
              See it move.
            </h1>
            <p className="mt-5 text-lg text-slate-500 max-w-md">
              Humancare Connect gives your team one place for projects, tasks,
              and deadlines — without the spreadsheet sprawl.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                to="/register"
                className="bg-ink text-white font-medium px-6 py-3 rounded-lg hover:bg-accent-dark transition-colors"
              >
                Start for free
              </Link>
              <Link
                to="/login"
                className="border border-slate-200 text-ink font-medium px-6 py-3 rounded-lg hover:border-accent transition-colors"
              >
                Log in
              </Link>
            </div>
          </div>

          <div className="bg-ink rounded-2xl p-10 flex items-center justify-center">
            <BoardIllustration />
          </div>
        </div>
      </main>
    </div>
  );
}

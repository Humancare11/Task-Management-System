import { Link } from "react-router-dom";
import BoardIllustration from "./BoardIllustration.jsx";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left — brand panel */}
      <div className="hidden md:flex flex-col justify-between bg-ink text-white p-12">
        <Link to="/" className="text-xl font-display font-extrabold tracking-tight">
          Flowboard
        </Link>

        <div>
          <BoardIllustration />
          <h2 className="mt-8 text-3xl font-display font-bold leading-tight max-w-sm">
            Plan the work. See it move.
          </h2>
          <p className="mt-3 text-white/60 max-w-sm">
            Projects, tasks, and timelines for teams who'd rather ship than
            manage spreadsheets.
          </p>
        </div>

        <p className="text-white/40 text-sm">© {new Date().getFullYear()} Flowboard</p>
      </div>

      {/* Right — form panel */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-display font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-slate-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

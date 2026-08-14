export default function SectionCard({ title, actions, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="font-display text-base font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

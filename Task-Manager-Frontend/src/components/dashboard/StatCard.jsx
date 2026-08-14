export default function StatCard({ icon: Icon, label, value, description }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Icon size={16} />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-display font-bold text-ink">{value}</p>
      {description && <p className="mt-1.5 text-xs text-slate-400">{description}</p>}
    </div>
  );
}

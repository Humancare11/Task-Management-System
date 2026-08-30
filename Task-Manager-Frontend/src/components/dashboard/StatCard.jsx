export default function StatCard({ label, value, description }) {
  return (
    <div className="px-5 py-4">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-txt-muted">
        {label}
      </span>
      <p className="mt-1.5 text-[20px] font-medium text-txt-primary">{value}</p>
      {description && (
        <p className="mt-1 text-[11px] leading-snug text-txt-muted">{description}</p>
      )}
    </div>
  );
}

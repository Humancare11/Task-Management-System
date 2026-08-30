export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hair bg-surface-1 px-6 py-16 text-center">
      {Icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-txt-muted">
          <Icon size={22} />
        </span>
      )}
      <h2 className="font-display text-base font-semibold text-txt-primary">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-txt-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

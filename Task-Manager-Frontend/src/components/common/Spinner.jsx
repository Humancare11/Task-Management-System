export default function Spinner({ label = "Loading..." }) {
  return (
    <div className="rounded-xl border border-hair bg-surface-1 p-8 text-center">
      <p className="text-sm text-txt-muted">{label}</p>
    </div>
  );
}

export default function Spinner({ label = "Loading..." }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export default function FormField({ label, ...props }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-ink placeholder:text-slate-400 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
      />
    </label>
  );
}

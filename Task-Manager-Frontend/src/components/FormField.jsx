export default function FormField({
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  required,
  minLength,
}) {
  return (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm text-white/80 mb-1.5">
        {label}
      </label>
      <input
        id={name}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="w-full rounded-lg bg-white/10 border border-white/10 text-white placeholder-white/40 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/[0.15] transition-colors"
      />
    </div>
  );
}

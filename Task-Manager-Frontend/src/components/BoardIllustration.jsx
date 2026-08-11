// Abstract kanban-board illustration — the product's own subject matter,
// used as the visual signature on auth screens instead of a stock photo or gradient.
export default function BoardIllustration() {
  const columns = [
    { cards: [40, 65, 25], color: "bg-white/20" },
    { cards: [55, 30, 70, 20], color: "bg-white/25" },
    { cards: [35, 50], color: "bg-white/20" },
  ];

  return (
    <div className="flex gap-4 items-start">
      {columns.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-3 w-20">
          <div className="h-2 w-10 rounded-full bg-white/40 mb-1" />
          {col.cards.map((h, i) => (
            <div
              key={i}
              className={`rounded-lg ${col.color} border border-white/20 animate-[fadeUp_0.6s_ease-out_backwards]`}
              style={{
                height: `${h}px`,
                animationDelay: `${(ci * 3 + i) * 90}ms`,
              }}
            />
          ))}
        </div>
      ))}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

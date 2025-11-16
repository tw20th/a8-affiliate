export default function FaqList({
  items,
  title = "よくある質問",
  className,
}: {
  items?: string[] | null;
  title?: string;
  className?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <section
      className={["rounded-xl border p-4 space-y-3", className]
        .filter(Boolean)
        .join(" ")}
    >
      <h2 className="font-semibold">{title}</h2>
      <ul className="list-disc pl-5 text-gray-700 space-y-1">
        {items.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </section>
  );
}

// apps/web/components/home/FeaturedSection.tsx
import Link from "next/link";

export default function FeaturedSection({
  title,
  items,
}: {
  title: string;
  items: any[]; // いったん緩くして安全にビルド通す
}) {
  return (
    <section className="mb-12">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {/* A8向けに "すべて見る" は offers ページへ */}
        <Link href="/offers" className="text-sm underline">
          すべて見る
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border p-6 text-sm opacity-70">
          まだデータがありません。同期をお待ちください。
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {items.map((_, i) => (
            <li
              key={i}
              className="rounded-lg border p-4 text-sm opacity-80 bg-white"
            >
              このセクションは A8オファー向けに調整中です。
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import Link from "next/link";
import Image from "next/image";

/**
 * ブログ・オファーの軽量カード
 * - slug があれば /blog/{slug}
 * - id があれば /offers/{id}
 * - href があれば href を優先
 */
export type RelatedItem = {
  title: string;
  slug?: string;
  id?: string;
  href?: string;
  /** ← null 許容にして lib 側と完全互換に */
  img?: string | null;
  badge?: string | null;
  summary?: string | null;
};

export default function RelatedByTags({
  title = "関連記事",
  items,
}: {
  title?: string;
  items: RelatedItem[];
}) {
  if (!items?.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">{title}</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((it, i) => {
          const fallback =
            (it.slug && `/blog/${encodeURIComponent(it.slug)}`) ||
            (it.id && `/offers/${encodeURIComponent(it.id)}`) ||
            "#";
          const href = it.href || fallback;

          return (
            <li key={`${it.slug || it.id || i}`} className="card p-4">
              <Link href={href} className="block">
                {it.img ? (
                  <Image
                    src={it.img}
                    alt={it.title}
                    width={640}
                    height={360}
                    unoptimized
                    className="w-full h-auto rounded-xl mb-2 img-soft"
                  />
                ) : null}

                <div className="font-medium line-clamp-2">{it.title}</div>

                {it.summary ? (
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                    {it.summary}
                  </p>
                ) : null}

                {it.badge ? (
                  <span className="inline-block mt-2 rounded-full border px-2 py-0.5 text-xs">
                    {it.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

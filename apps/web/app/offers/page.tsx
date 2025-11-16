import Link from "next/link";
import { getServerSiteId, getSiteEntry } from "@/lib/site-server";
import { notFound } from "next/navigation";
import OfferGallery from "@/components/offers/OfferGallery";
import OfferCompareTable, {
  type OfferLite,
} from "@/components/offers/OfferCompareTable";
import {
  fsRunQuery,
  vStr,
  vNum,
  fsGetStringArray,
  type FsValue,
  docIdFromName,
  fsDecode,
} from "@/lib/firestore-rest";

export const revalidate = 60;
export const dynamic = "force-dynamic";

type FsDoc = { name: string; fields: Record<string, FsValue> };

function normalizeOffer(d: FsDoc): OfferLite {
  const f = d.fields;

  const extras =
    f?.extras !== undefined ? (fsDecode(f.extras) as unknown) : undefined;

  // top-level ui を優先し、なければ extras.ui を使う
  const topLevelUi =
    f?.ui !== undefined ? (fsDecode(f.ui) as OfferLite["ui"]) : undefined;
  const ui =
    topLevelUi ??
    (extras && typeof extras === "object"
      ? (extras as { ui?: OfferLite["ui"] }).ui
      : undefined);

  return {
    id: docIdFromName(d.name),
    title: vStr(f, "title") ?? "",
    affiliateUrl: vStr(f, "affiliateUrl") ?? vStr(f, "landingUrl") ?? "",
    badges: fsGetStringArray(f, "badges") ?? [],
    priceMonthly: vNum(f, "priceMonthly") ?? null,
    minTermMonths: vNum(f, "minTermMonths") ?? null,
    notes:
      fsGetStringArray(f, "highlights") ?? fsGetStringArray(f, "tags") ?? [],
    ui,
  };
}

async function fetchTopOffers(siteId: string, limit = 3): Promise<OfferLite[]> {
  const docs = await fsRunQuery({
    collection: "offers",
    where: [
      { field: "siteIds", op: "ARRAY_CONTAINS", value: siteId },
      { field: "archived", value: false },
    ],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit,
  }).catch(() => [] as any);
  return (docs as FsDoc[]).map(normalizeOffer);
}

async function fetchCompareKeywords(siteId: string): Promise<string[]> {
  // sites/{siteId}.keywordPools.comparison を優先
  try {
    const siteDoc = await fetch(
      `https://firestore.googleapis.com/v1/projects/${
        process.env.NEXT_PUBLIC_FB_PROJECT_ID
      }/databases/(default)/documents/sites/${encodeURIComponent(siteId)}?key=${
        process.env.NEXT_PUBLIC_FB_API_KEY
      }`,
      { cache: "no-store" }
    ).then((r) => r.json());
    const arr =
      siteDoc?.fields?.keywordPools?.mapValue?.fields?.comparison?.arrayValue
        ?.values ?? [];
    const fromSite = arr.map((v: any) => v?.stringValue).filter(Boolean);
    if (fromSite.length) return fromSite as string[];
  } catch {}
  // fallback: 人気タグ上位
  const docs = (await fsRunQuery({
    collection: "offers",
    where: [
      { field: "siteIds", op: "ARRAY_CONTAINS", value: siteId },
      { field: "archived", value: false },
    ],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit: 100,
  }).catch(() => [] as any)) as FsDoc[];
  const count = new Map<string, number>();
  for (const d of docs) {
    const tags = fsGetStringArray(d.fields, "tags") ?? [];
    for (const t of tags) count.set(t, (count.get(t) ?? 0) + 1);
  }
  return Array.from(count.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);
}

/** JSON-LD用の軽量一覧（ItemList） */
async function fetchOffersForSchema(siteId: string, limit = 24) {
  const docs = await fsRunQuery({
    collection: "offers",
    where: [
      { field: "siteIds", op: "ARRAY_CONTAINS", value: siteId },
      { field: "archived", value: false },
    ],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit,
  }).catch(() => [] as any);
  return (docs as FsDoc[]).map((d) => {
    const f = d.fields;
    return {
      id: docIdFromName(d.name),
      name: vStr(f, "title") ?? "",
      url: vStr(f, "affiliateUrl") ?? vStr(f, "landingUrl") ?? "",
      priceMonthly: vNum(f, "priceMonthly") ?? null,
    };
  });
}

/** ページメタ（タイトル/ディスクリプション） */
export async function generateMetadata() {
  return {
    title: "家電レンタルのおすすめ一覧｜比較・料金・最低期間",
    description:
      "家電レンタルの主要サービスをまとめて比較。月額料金・最低利用期間・特徴をわかりやすく一覧表示します。（本ページは広告を含みます）",
  };
}

export default async function OffersPage() {
  const siteId = getServerSiteId();
  const s = getSiteEntry();
  if (s.features?.offers === false) notFound();

  const [top3, keywords] = await Promise.all([
    fetchTopOffers(siteId, 3),
    fetchCompareKeywords(siteId),
  ]);

  // サイトURL（他のページと同じ書き方に合わせる）
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kariraku.com"
  ).replace(/\/$/, "");

  // JSON-LD データを生成
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: `${siteUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "家電レンタルおすすめ",
        item: `${siteUrl}/offers`,
      },
    ],
  };

  const itemListLd =
    top3.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: top3.map((o, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: o.title,
            url:
              o.affiliateUrl || `${siteUrl}/offers/${encodeURIComponent(o.id)}`,
          })),
        }
      : null;

  return (
    <main className="container-kariraku space-y-10">
      {/* 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {itemListLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
        />
      )}

      {/* Hero */}
      <section className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold">家電レンタルおすすめ</h1>
        <p className="text-sm text-gray-600">※ 本ページは広告を含みます</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/compare"
            className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700"
          >
            まずは比較して選ぶ →
          </Link>
          <Link
            href="#all"
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
          >
            すべての案件を見る
          </Link>
        </div>
      </section>

      {/* 比較チップ */}
      {keywords.length > 0 && (
        <section className="space-y-3">
          <h2 className="h2">人気の比較テーマ</h2>
          <div className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <Link
                key={k}
                href={`/compare/${encodeURIComponent(k)}`}
                className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50"
              >
                {k}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* クイック比較（上位3社） */}
      {top3.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="h2">まずは3社をサクッと比較</h2>
            <Link href="/compare" className="text-sm underline">
              もっと比較する
            </Link>
          </div>
          <OfferCompareTable
            items={top3}
            caption="月額・最低期間・特徴を比較"
          />
        </section>
      )}

      {/* 一覧 */}
      <section id="all" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="h2">掲載中のサービス一覧</h2>
        </div>
        <OfferGallery siteId={siteId} variant="grid" limit={24} />
      </section>
    </main>
  );
}

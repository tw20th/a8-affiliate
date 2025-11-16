// apps/web/app/compare/page.tsx
import Link from "next/link";
import OfferCompareTable, {
  type OfferLite,
} from "@/components/offers/OfferCompareTable";
import {
  fsRunQuery,
  fsDecode,
  fsGetStringArray,
  type FsValue,
} from "@/lib/firestore-rest";
import { getServerSiteId } from "@/lib/site-server";

// Firestore REST 用の簡易型
type FsDoc = {
  name: string;
  fields: Record<string, FsValue>;
};

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const siteId = getServerSiteId();

  // Firestore からこのサイト向けのオファーを取得
  const raw = (await fsRunQuery({
    collection: "offers",
    where: [
      { field: "siteIds", op: "ARRAY_CONTAINS", value: siteId },
      { field: "archived", op: "EQUAL", value: false },
      // status がある場合は active のみ
      { field: "status", op: "EQUAL", value: "active" },
    ],
    limit: 10,
  })) as FsDoc[];

  const items: OfferLite[] = raw.map((doc, index) => {
    const f = doc.fields;
    const ui = (fsDecode(f.ui) as OfferLite["ui"]) ?? undefined;

    return {
      id: doc.name,
      title: (fsDecode(f.title) as string) ?? "",
      affiliateUrl: (fsDecode(f.affiliateUrl) as string) ?? "",
      badges: fsGetStringArray(f, "badges") ?? [],
      priceMonthly: (fsDecode(f.priceMonthly) as number | null) ?? null,
      minTermMonths: (fsDecode(f.minTermMonths) as number | null) ?? null,
      notes: fsGetStringArray(f, "notes") ?? [],
      ui,
      // ひとまず先頭をおすすめ扱い（あとでフラグ運用も可能）
      isRecommended: index === 0,
      // 比較用の一言ラベル（なければ notes 先頭をフォールバック）
      compareHighlight:
        (ui as any)?.compareHighlight ??
        (fsGetStringArray(f, "notes") ?? [])[0] ??
        undefined,
    };
  });

  return (
    <main className="container-kariraku p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="h1">家電レンタルサービスを一覧で比較</h1>
        <p className="text-sm text-gray-600">
          月額の目安・最低利用期間・特徴をまとめて比較できます。気になるサービスがあれば「公式へ」ボタンから詳細を確認してください。
        </p>
        <p className="text-xs text-gray-400">※ 本ページは広告を含みます</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">
          月額・最低期間・特徴の一覧比較
        </h2>
        <OfferCompareTable
          caption="月額の目安・最低利用期間・特徴を一覧で比較"
          items={items}
        />
        <p className="mt-2 text-xs text-gray-500">
          ※
          掲載している料金や条件は記事作成時点のものです。最新情報は必ず各公式サイトでご確認ください。
        </p>
      </section>

      <p className="text-sm">
        <Link
          href="/offers"
          className="inline-flex items-center gap-1 underline"
        >
          ← 家電レンタルの一覧に戻る
        </Link>
      </p>
    </main>
  );
}

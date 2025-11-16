// apps/web/app/pain/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSiteId } from "@/lib/site-server";
import { decodePainRules } from "@/lib/pain-rules";

export const revalidate = 60;
export const dynamic = "force-dynamic";

async function loadPainRule(siteId: string, id: string) {
  const projectId = process.env.NEXT_PUBLIC_FB_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FB_API_KEY;
  if (!projectId || !apiKey) return null;

  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/sites/${encodeURIComponent(
      siteId
    )}`
  );
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;

  const json = (await res.json()) as
    | { fields?: Record<string, unknown> }
    | undefined;
  const rules = decodePainRules(json?.fields);
  return rules.find((r) => r.id === id) ?? null;
}

export default async function PainPage({ params }: { params: { id: string } }) {
  const siteId = getServerSiteId();
  const rule = await loadPainRule(siteId, params.id);
  if (!rule) return notFound();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <nav className="text-sm text-gray-500">
        <Link href="/" className="underline">
          ホーム
        </Link>
        <span className="mx-1">/</span>
        <span>悩み: {rule.label}</span>
      </nav>

      <h1 className="mt-3 text-2xl font-bold">{rule.label}</h1>

      {/* 共感 → 解決（簡易コピー。必要に応じて自動生成に置換可） */}
      <section className="mt-4 rounded-xl border p-4">
        <h2 className="mb-2 font-semibold">こんな時はありませんか？</h2>
        <p className="text-sm opacity-80">
          毎日の作業や趣味の時間で感じる不快感・不安は、小さな工夫と
          正しいサービス選びで大きく改善できます。 下では、
          {rule.tags.map((t) => `#${t}`).join(" / ")} に関係する
          視点を整理しています。
        </p>
      </section>

      {/* 悩みに紐づくタグ・解説（旧: 商品一覧エリア） */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">この悩みのポイント</h2>
          <div className="flex flex-wrap gap-2 text-xs opacity-70">
            {rule.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border px-2 py-0.5 bg-white"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-6 text-sm opacity-80">
          <p>
            このページでは、A8オファーと連携したおすすめ一覧を順次追加していきます。
          </p>
          <p className="mt-2">
            いまは「悩み」と「タグ」の整理が中心ですが、
            近いうちにこの悩みにピッタリなサービスをここで比較できるようにする予定です。
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-10 rounded-xl border p-4 text-sm">
        <p className="mb-2 font-medium">チェックしておきたいポイント</p>
        <ul className="list-inside list-disc opacity-80">
          <li>自分の悩み（{rule.label}）に近いかどうか</li>
          <li>タグ（{rule.tags.join(" / ")}）の中で特に気になるもの</li>
          <li>いまの状態で「やめたいこと」「増やしたいこと」は何か</li>
        </ul>
      </section>
    </main>
  );
}

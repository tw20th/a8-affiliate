import type { MetadataRoute } from "next";

// ✅ 常に実行（Vercelキャッシュに乗らないように）
export const dynamic = "force-dynamic";

// Firestore REST最小実装（依存なし）
async function runQuery(body: any) {
  const projectId = process.env.NEXT_PUBLIC_FB_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FB_API_KEY;
  if (!projectId || !apiKey) {
    // 本番で未設定でも sitemap 自体は返す
    return null;
  }
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`
  );
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Firestore取得失敗時は静的URLのみで返す
    return null;
  }
  return res.json();
}

// Firestore REST の name から docId を取る
function docIdFromName(name: string): string {
  const i = name.lastIndexOf("/");
  return i >= 0 ? name.slice(i + 1) : name;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.kariraku.com"
  ).replace(/\/$/, "");
  const siteId = process.env.NEXT_PUBLIC_SITE_ID || "kariraku";

  const out: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // Firestore が使えない/失敗しても sitemap 自体は返す設計
  const resp = await runQuery({
    structuredQuery: {
      from: [{ collectionId: "blogs" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: "status" },
                op: "EQUAL",
                value: { stringValue: "published" },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: "siteId" },
                op: "EQUAL",
                value: { stringValue: siteId },
              },
            },
          ],
        },
      },
      limit: 5000,
    },
  });

  if (Array.isArray(resp)) {
    for (const row of resp) {
      const doc = row?.document;
      if (!doc) continue;
      const slug = docIdFromName(doc.name);
      const updatedAt =
        Number(
          doc.fields?.updatedAt?.integerValue ??
            doc.fields?.updatedAt?.doubleValue
        ) || Date.now();
      out.push({
        url: `${baseUrl}/blog/${slug}`,
        lastModified: new Date(updatedAt),
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  }

  return out;
}

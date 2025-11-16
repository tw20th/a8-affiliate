// firebase/functions/src/services/unsplash/client.ts
type Hero = { url: string; credit?: string; creditLink?: string };

// ✅ 追加：Unsplash 検索レスポンスの最小型
type UnsplashLink = { html?: string };
type UnsplashUser = { name?: string; links?: UnsplashLink };
type UnsplashUrls = {
  regular?: string;
  full?: string;
  small?: string;
  raw?: string;
};
type UnsplashPhoto = {
  urls?: UnsplashUrls;
  user?: UnsplashUser;
  links?: UnsplashLink;
};
type UnsplashSearchResponse = { results?: UnsplashPhoto[] };

function buildQueries(raw: string) {
  const s = (raw || "").trim();
  const list: string[] = [];

  if (s) list.push(s);

  const jp = s
    .replace(/[『』【】｜|]/g, " ")
    .replace(/[^a-zA-Z0-9\u3040-\u30ff\u4e00-\u9faf ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const jpFocus = jp.filter((w) =>
    /(家電|冷蔵庫|洗濯機|電子レンジ|レンタル|サブスク)/.test(w)
  );
  if (jpFocus.length) list.push(jpFocus.join(" "));

  list.push(
    "home appliances",
    "kitchen appliances",
    "living room interior",
    "appliance store",
    "electronics",
    "appliance rental"
  );

  return Array.from(new Set(list)).slice(0, 8);
}

export async function findUnsplashHero(query: string): Promise<Hero | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  const queries = buildQueries(query);

  for (const q of queries) {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", q);
    url.searchParams.set("per_page", "5");
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("content_filter", "high");
    url.searchParams.set("order_by", "relevant");

    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: `Client-ID ${key}`,
        "Accept-Version": "v1",
      },
    });

    if (!resp.ok) {
      try {
        const t = await resp.text();
        console.warn("[unsplash]", resp.status, t.slice(0, 200));
      } catch {}
      continue;
    }

    // ✅ 型を明示して安全に参照
    const data = (await resp
      .json()
      .catch(() => null)) as UnsplashSearchResponse | null;
    const first =
      data?.results && data.results.length > 0 ? data.results[0] : undefined;
    if (!first) continue;

    const urlPick =
      first.urls?.regular ||
      first.urls?.full ||
      first.urls?.small ||
      first.urls?.raw;
    if (!urlPick) continue;

    const credit = first.user?.name || undefined;
    const creditLink =
      first.links?.html || first.user?.links?.html || undefined;

    return { url: urlPick, credit, creditLink };
  }

  return null;
}

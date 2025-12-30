//firebase/functions/src/lib/content/jobs/generateForActiveBundle.ts
/* eslint-disable @typescript-eslint/no-floating-promises */

import { Timestamp } from "firebase-admin/firestore";
import { generateBlogContent } from "../../../utils/generateBlogContent.js";
import { findUnsplashHero } from "../../../services/unsplash/client.js";
import { pickBestKeywordForSite } from "../../keywords/pickSiteKeyword.js";
import { decideBundleSlot } from "../bundles.js";
import { getActiveBundleId } from "../../bundles/getActiveBundle.js";
import { getSeasonalContext } from "../../../utils/seasonalContext.js";
import { parseAiBlogOutput } from "../engine/parseAiBlogOutput.js";

type Intent = "guide" | "discover";

type PickedKeyword = {
  docId: string;
  keyword: string;
  raw: Record<string, unknown>;
};

type RawEngineOut = {
  // content-engine が返す “生” の可能性があるので、最低限だけ
  title?: string;
  excerpt?: string | null;
  tags?: string[];
  content?: string;
  imageUrl?: string | null;
  imageCredit?: string | null;
  imageCreditLink?: string | null;
};

type OfferVars = {
  primaryOfferId?: string | null;
  offerIds?: string[];
};

export type GenerateForActiveBundlePrepareArgs = {
  siteId: string;
  siteName: string;
  intent: Intent;

  seasonal: { keyword: string; label: string; description: string };
  bundleId: string | null;

  pickedKeyword: PickedKeyword | null;
};

export type GenerateForActiveBundlePrepared = {
  templateName: string;

  /** generateBlogContent に渡す */
  product: { name: string; asin: string; tags: string[] };
  persona: string;
  pain: string;

  /** vars に必ず intent / seasonKeyword / primaryKeyword が入る想定 */
  vars: Record<string, unknown>;

  /** Firestore blogs に保存する type */
  blogType: Intent;

  /** primaryKeyword の保存 */
  primaryKeyword: string;
  primaryKeywordDocId: string | null;

  /** tags の足し込み（必要なら） */
  extraTags?: string[];

  /** Unsplash 検索に使うクエリ（任意） */
  imageQuery?: string;

  /** offers 連携（任意） */
  offers?: OfferVars;
};

function sanitizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slugify(siteId: string, base: string): string {
  const lower = base
    .toLowerCase()
    .replace(/[ぁ-んァ-ン]/g, "")
    .replace(/[^\w\s\u4e00-\u9fa5-]/g, " ")
    .trim();
  const hyphenated = lower.replace(/\s+/g, "-");

  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  const core = hyphenated || "post";
  return `${siteId}-${y}${m}${d}-${core}`.slice(0, 80);
}

export async function generateForActiveBundle(params: {
  db: FirebaseFirestore.Firestore;
  siteId: string;
  siteName: string;
  intent: Intent;

  prepare: (
    args: GenerateForActiveBundlePrepareArgs
  ) => Promise<GenerateForActiveBundlePrepared | null>;
}): Promise<
  | {
      ok: true;
      siteId: string;
      slug: string;
      title: string;
      bundleId: string | null;
      primaryKeyword: string;
    }
  | { ok: false; siteId: string; reason: string }
> {
  const { db, siteId, siteName, intent, prepare } = params;

  // 1) まず「束の枠」が空いてるかチェック
  const bundleSlot = await decideBundleSlot({ db, siteId, intent });
  if (!bundleSlot.ok) {
    return { ok: false, siteId, reason: "bundle-completed" };
  }

  // 2) activeBundleId（無ければnull）
  const bundleId = await getActiveBundleId(siteId, intent);

  // 3) 季節
  const seasonal = getSeasonalContext();

  // 4) キーワード（無ければ null も許容）
  const picked = await pickBestKeywordForSite({
    siteId,
    intent,
    avoidHours: 12,
  });

  const pickedKeyword: PickedKeyword | null = picked
    ? {
        docId: picked.docId,
        keyword: picked.keyword,
        raw:
          typeof (picked as { raw?: unknown }).raw === "object" &&
          (picked as { raw?: unknown }).raw !== null
            ? ((picked as { raw?: unknown }).raw as Record<string, unknown>)
            : {},
      }
    : null;

  // 5) intent差分（callerが全部決める）
  const prepared = await prepare({
    siteId,
    siteName,
    intent,
    seasonal,
    bundleId,
    pickedKeyword,
  });

  if (!prepared) {
    return { ok: false, siteId, reason: "prepare-returned-null" };
  }

  // 6) 生成（まずは “生” を受け取る）
  const rawOutUnknown = await generateBlogContent({
    siteId,
    siteName,
    product: prepared.product,
    persona: prepared.persona,
    pain: prepared.pain,
    templateName: prepared.templateName,
    vars: prepared.vars,
  });

  const rawOut = rawOutUnknown as RawEngineOut;

  const rawTitleFallback = sanitizeText(rawOut.title) || prepared.product.name;

  const rawContent = sanitizeText(rawOut.content) || "";
  const rawTags = Array.isArray(rawOut.tags)
    ? rawOut.tags
    : prepared.product.tags;

  // ★ ここが肝：JSON出力（```json ...）でも Markdown表示用に整形する
  const parsed = parseAiBlogOutput({
    raw: rawContent,
    fallbackTitle: rawTitleFallback,
    fallbackTags: rawTags,
  });

  const title = sanitizeText(parsed.title).trim() || prepared.product.name;
  const content = sanitizeText(parsed.content);
  const excerpt = parsed.excerpt !== null ? sanitizeText(parsed.excerpt) : null;

  // tags
  const baseTags = parsed.tags;
  const merged = [...baseTags, seasonal.keyword, ...(prepared.extraTags ?? [])]
    .map((t) => String(t ?? "").trim())
    .filter((t) => t.length > 0);
  const tags = Array.from(new Set(merged));

  // 7) 画像（無ければUnsplash）
  let imageUrl: string | null = rawOut.imageUrl ?? null;
  let imageCredit: string | null = rawOut.imageCredit ?? null;
  let imageCreditLink: string | null = rawOut.imageCreditLink ?? null;

  if (!imageUrl) {
    const q = prepared.imageQuery?.trim() || title || prepared.primaryKeyword;
    const hero = await findUnsplashHero(q);
    if (hero?.url) {
      imageUrl = hero.url;
      imageCredit = hero.credit ?? null;
      imageCreditLink = hero.creditLink ?? null;
    }
  }

  // 8) 保存
  const nowMs = Date.now();
  const nowTs = Timestamp.fromMillis(nowMs);
  const slug = slugify(siteId, title);

  const ref = db.collection("blogs").doc(slug);
  await ref.set(
    {
      siteId,
      title,
      content, // ✅ ここは「表示用Markdown本文」
      excerpt, // ✅ ここも “json { ...” にならない
      tags,
      slug,
      type: prepared.blogType,
      status: "published",
      bundleId: bundleId ?? null,
      imageUrl,
      imageCredit,
      imageCreditLink,
      createdAt: nowTs,
      updatedAt: nowTs,
      publishedAt: nowTs,
      primaryKeyword: prepared.primaryKeyword,
      primaryKeywordDocId: prepared.primaryKeywordDocId,
      primaryOfferId: prepared.offers?.primaryOfferId ?? null,
      offerIds: prepared.offers?.offerIds ?? [],

      // （任意）デバッグ用：AIの構造JSONを保持したいなら
      // aiJson: parsed.json ?? null,
    },
    { merge: true }
  );

  // 9) キーワード統計（pickedがある時だけ）
  if (pickedKeyword) {
    const kwRef = db.collection("siteKeywords").doc(pickedKeyword.docId);
    const prev = pickedKeyword.raw;

    const prevUsed =
      typeof prev.usedCount === "number" && Number.isFinite(prev.usedCount)
        ? prev.usedCount
        : 0;

    await kwRef.set(
      {
        usedCount: prevUsed + 1,
        lastUsedAt: nowMs,
        lastBlogSlug: slug,
        updatedAt: nowMs,
      },
      { merge: true }
    );
  }

  return {
    ok: true,
    siteId,
    slug,
    title,
    bundleId: bundleId ?? null,
    primaryKeyword: prepared.primaryKeyword,
  };
}

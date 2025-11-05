// firebase/functions/src/jobs/content/scheduledBlogDaily.ts
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getBlogEnabledSiteIds } from "../../lib/sites/sites.js";
import { generateBlogFromOffer } from "./generateBlogFromOffer.js";

const REGION = "asia-northeast1";
const TZ = "Asia/Tokyo";
const db = getFirestore();

/** offers から siteId 向けの候補を1つ拾う */
async function pickOfferForSite(siteId: string): Promise<string | null> {
  const snap = await db
    .collection("offers")
    .where("siteIds", "array-contains", siteId)
    .where("archived", "==", false)
    .orderBy("updatedAt", "desc")
    .limit(20)
    .get();
  if (snap.empty) return null;
  const docs = snap.docs;
  const idx = Math.floor(Math.random() * docs.length);
  return docs[idx].id;
}

/** 正午 12:00 … A8オファーから1本（公開） */
export const scheduledBlogNoon = functions
  .region(REGION)
  .runWith({ secrets: ["OPENAI_API_KEY"] })
  .pubsub.schedule("0 12 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    const siteIds = await getBlogEnabledSiteIds(db);
    const results: Array<{ siteId: string; slug?: string | null }> = [];

    for (const siteId of siteIds) {
      const offerId = await pickOfferForSite(siteId);
      if (!offerId) {
        results.push({ siteId, slug: null });
        continue;
      }

      // 直近7日以内に同一 offerId を作っていたらスキップ
      const recentSince = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const existSnap = await db
        .collection("blogs")
        .where("offerId", "==", offerId)
        .where("siteId", "==", siteId)
        .limit(5)
        .get();

      const recentExists = existSnap.docs.some(
        (d) => Number(d.get("createdAt") || 0) > recentSince
      );
      if (recentExists) {
        results.push({ siteId, slug: existSnap.docs[0]?.id ?? null });
        continue;
      }

      const out = await generateBlogFromOffer({
        offerId,
        siteId,
        publish: true,
        dryRun: false,
      });
      results.push({ siteId, slug: out.slug });
    }

    return { results };
  });

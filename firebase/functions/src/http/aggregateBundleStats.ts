//firebase/functions/src/http/aggregateBundleStats.ts
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

if (getApps().length === 0) initializeApp();
const db = getFirestore();

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

/**
 * GET /admin/aggregateBundleStats?bundleId=xxx
 *
 * - bundleId に紐づく blogs を集計
 * - blogs.seo（impressions / clicks / position）を束ねる
 * - bundles/{bundleId}.stats に保存
 */
export const aggregateBundleStats = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    try {
      const bundleId = String(req.query.bundleId || "").trim();
      if (!bundleId) {
        res.status(400).json({ ok: false, error: "bundleId required" });
        return;
      }

      const blogsSnap = await db
        .collection("blogs")
        .where("bundleId", "==", bundleId)
        .where("status", "==", "published")
        .get();

      if (blogsSnap.empty) {
        const stats = {
          blogCount: 0,
          impressions: 0,
          clicks: 0,
          avgPosition: null,
          publishedFrom: null,
          publishedTo: null,
          updatedAt: Date.now(),
        };

        await db
          .collection("bundles")
          .doc(bundleId)
          .set({ stats }, { merge: true });

        res.status(200).json({ ok: true, bundleId, stats });
        return;
      }

      let minPublished = Number.MAX_SAFE_INTEGER;
      let maxPublished = 0;

      let totalImpressions = 0;
      let totalClicks = 0;
      let positionSum = 0;
      let positionCount = 0;

      for (const doc of blogsSnap.docs) {
        const data = doc.data();

        // 投稿日の集計
        const ts = data.publishedAt?.toMillis?.();
        if (typeof ts === "number") {
          minPublished = Math.min(minPublished, ts);
          maxPublished = Math.max(maxPublished, ts);
        }

        // SEO データの集計（GSC 反映済み前提）
        const seo = data.seo;
        if (seo) {
          if (typeof seo.impressions === "number") {
            totalImpressions += seo.impressions;
          }
          if (typeof seo.clicks === "number") {
            totalClicks += seo.clicks;
          }
          if (typeof seo.position === "number") {
            positionSum += seo.position;
            positionCount += 1;
          }
        }
      }

      const stats = {
        blogCount: blogsSnap.size,
        impressions: totalImpressions,
        clicks: totalClicks,
        avgPosition:
          positionCount > 0
            ? Number((positionSum / positionCount).toFixed(2))
            : null,
        publishedFrom:
          minPublished === Number.MAX_SAFE_INTEGER ? null : minPublished,
        publishedTo: maxPublished || null,
        updatedAt: Date.now(),
      };

      await db
        .collection("bundles")
        .doc(bundleId)
        .set({ stats }, { merge: true });

      res.status(200).json({
        ok: true,
        bundleId,
        stats,
      });
    } catch (e: any) {
      console.error("[aggregateBundleStats] error", e);
      res.status(500).json({
        ok: false,
        error: e?.message || String(e),
      });
    }
  });

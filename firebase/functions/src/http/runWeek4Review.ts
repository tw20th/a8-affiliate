// firebase/functions/src/http/runWeek4Review.ts
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { buildNextCandidates } from "../lib/bundles/nextQuestionCandidates.js";
import { postToSlack } from "../services/slack/webhook.js";
import { buildBundleReviewSlackPayload } from "../lib/bundles/slackMessage.js";

if (getApps().length === 0) initializeApp();
const db = getFirestore();

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

export const runWeek4Review = functions
  .region(REGION)
  .runWith({ secrets: ["SLACK_WEBHOOK_URL"] })
  .https.onRequest(async (req, res) => {
    try {
      const bundleId = String(req.query.bundleId || "").trim();
      if (!bundleId) {
        res.status(400).json({ ok: false, error: "bundleId required" });
        return;
      }

      /* ---------- bundle 本体 ---------- */
      const bundleRef = db.collection("bundles").doc(bundleId);
      const bundleSnap = await bundleRef.get();
      if (!bundleSnap.exists) {
        res.status(404).json({ ok: false, error: "bundle not found" });
        return;
      }

      const bundle = bundleSnap.data() as {
        siteId: string;
        question: string;
      };

      /* ---------- ① stats 再集計 ---------- */
      const blogsSnap = await db
        .collection("blogs")
        .where("bundleId", "==", bundleId)
        .where("status", "==", "published")
        .get();

      let impressions = 0;
      let clicks = 0;
      let positionSum = 0;
      let positionCount = 0;

      const primaryKeywords: string[] = [];

      for (const doc of blogsSnap.docs) {
        const d = doc.data();

        if (typeof d.primaryKeyword === "string") {
          primaryKeywords.push(d.primaryKeyword);
        }

        const seo = d.seo;
        if (seo) {
          impressions += Number(seo.impressions || 0);
          clicks += Number(seo.clicks || 0);
          if (typeof seo.position === "number") {
            positionSum += seo.position;
            positionCount += 1;
          }
        }
      }

      const stats = {
        blogCount: blogsSnap.size,
        impressions,
        clicks,
        avgPosition:
          positionCount > 0
            ? Number((positionSum / positionCount).toFixed(2))
            : null,
        updatedAt: Date.now(),
      };

      /* ---------- ② 判定 ---------- */
      let decision: "WAIT" | "KEEP" | "IMPROVE" | "DROP" = "WAIT";
      const reasons: string[] = [];

      if (stats.blogCount < 3) {
        decision = "WAIT";
        reasons.push("記事数が少ないため判定待ち");
      } else if (stats.impressions < 30) {
        decision = "DROP";
        reasons.push("露出がほとんど無い");
      } else if (
        stats.clicks === 0 ||
        stats.clicks / Math.max(1, stats.impressions) < 0.01
      ) {
        decision = "IMPROVE";
        reasons.push("露出はあるがクリックが弱い");
      } else {
        decision = "KEEP";
        reasons.push("露出・クリックともに良好");
      }

      const review = {
        decision,
        reasons,
        reviewedAt: Date.now(),
      };

      /* ---------- ③ seedKeywords 準備 ---------- */
      const seedKeywords = Array.from(
        new Set(primaryKeywords.filter(Boolean))
      ).slice(0, 3);

      if (seedKeywords.length < 3) {
        const supplementSnap = await db
          .collection("siteKeywords")
          .where("siteId", "==", bundle.siteId)
          .orderBy("usedCount", "asc")
          .limit(5)
          .get();

        for (const doc of supplementSnap.docs) {
          const kw = doc.get("keyword");
          if (typeof kw === "string" && !seedKeywords.includes(kw)) {
            seedKeywords.push(kw);
          }
          if (seedKeywords.length >= 3) break;
        }
      }

      /* ---------- ④ 次の問い候補生成 ---------- */
      const nextCandidates = buildNextCandidates({
        siteId: bundle.siteId,
        decision,
        bundleQuestion: bundle.question,
        seedKeywords,
      });

      /* ---------- ⑤ Firestore 保存 ---------- */
      await bundleRef.set(
        {
          stats,
          review,
          nextCandidates: {
            generatedAt: Date.now(),
            decision,
            items: nextCandidates,
          },
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      /* ---------- ⑥ Slack 通知 ---------- */
      try {
        const slackPayload = buildBundleReviewSlackPayload({
          siteId: bundle.siteId,
          bundleId,
          question: bundle.question,
          decision,
          reasons,
          stats: {
            blogCount: stats.blogCount,
            impressions: stats.impressions,
            clicks: stats.clicks,
            avgPosition: stats.avgPosition,
          },
          candidates: nextCandidates.map((c) => ({
            question: c.question,
            intent: c.intent,
            template: c.template,
          })),
        });

        await postToSlack(slackPayload);
      } catch (err) {
        console.error("[runWeek4Review] slack notify failed", err);
      }

      res.status(200).json({
        ok: true,
        bundleId,
        decision,
        stats,
        nextCandidates,
      });
    } catch (e: unknown) {
      console.error("[runWeek4Review] error", e);
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

//firebase/functions/src/http/startBundleFromCandidate.ts
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { postToSlack } from "../services/slack/webhook.js";
import { startBundleFromCandidateLogic } from "../lib/bundles/startBundleFromCandidateLogic.js";
import { buildBundleStartedSlackResponse } from "../lib/bundles/slackMessage.js";

if (getApps().length === 0) initializeApp();
const db = getFirestore();

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

/**
 * POST /admin/startBundleFromCandidate
 * body:
 * {
 *   "bundleId": "xxx",
 *   "candidateIndex": 0
 * }
 */
export const startBundleFromCandidate = functions
  .region(REGION)
  .runWith({ secrets: ["SLACK_WEBHOOK_URL"] })
  .https.onRequest(async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "POST only" });
        return;
      }

      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};

      const bundleId =
        typeof body.bundleId === "string" ? body.bundleId.trim() : "";
      const candidateIndex =
        typeof body.candidateIndex === "number" ? body.candidateIndex : NaN;

      if (!bundleId || !Number.isFinite(candidateIndex)) {
        res.status(400).json({
          ok: false,
          error: "bundleId and candidateIndex are required",
        });
        return;
      }

      const started = await startBundleFromCandidateLogic({
        db,
        bundleId,
        candidateIndex,
      });

      // Slack 通知（Webhook）
      try {
        const payload = buildBundleStartedSlackResponse({
          siteId: started.siteId,
          newBundleId: started.newBundleId,
          intent: started.intent,
          question: started.question,
          template: started.template,
          startedBy: "admin-api",
        });

        await postToSlack(payload);
      } catch (err) {
        // Slack 失敗では処理全体は落とさない
        console.error("[startBundleFromCandidate] slack notify failed", err);
      }

      res.status(200).json({
        ok: true,
        siteId: started.siteId,
        intent: started.intent,
        newBundleId: started.newBundleId,
        question: started.question,
        template: started.template,
      });
    } catch (e: unknown) {
      console.error("[startBundleFromCandidate] error", e);
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

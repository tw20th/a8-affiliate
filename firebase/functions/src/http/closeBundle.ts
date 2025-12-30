//firebase/functions/src/http/closeBundle.ts
import * as functions from "firebase-functions";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

if (getApps().length === 0) initializeApp();
const db = getFirestore();

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

/**
 * POST /admin/closeBundle
 *
 * body:
 * {
 *   "bundleId": "workiroom_2025w01_q3",
 *   "reason": "Week4 判定で DROP"
 * }
 */
export const closeBundle = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "POST only" });
        return;
      }

      const { bundleId, reason } = req.body ?? {};

      if (!bundleId) {
        res.status(400).json({
          ok: false,
          error: "bundleId is required",
        });
        return;
      }

      const ref = db.collection("bundles").doc(bundleId);
      const snap = await ref.get();

      if (!snap.exists) {
        res.status(404).json({
          ok: false,
          error: "bundle not found",
          bundleId,
        });
        return;
      }

      const now = Timestamp.now();

      await ref.set(
        {
          status: "archived",
          closedAt: now,
          closeReason: typeof reason === "string" ? reason : null,
          updatedAt: now,
        },
        { merge: true }
      );

      res.status(200).json({
        ok: true,
        bundleId,
        status: "archived",
        reason: reason ?? null,
      });
    } catch (e: any) {
      console.error("[closeBundle] error", e);
      res.status(500).json({
        ok: false,
        error: e?.message || String(e),
      });
    }
  });

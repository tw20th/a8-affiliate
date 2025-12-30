// firebase/functions/src/http/createBundle.ts
import * as functions from "firebase-functions";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

if (getApps().length === 0) initializeApp();
const db = getFirestore();

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

type Intent = "discover" | "guide";

/**
 * POST /admin/createBundle
 *
 * body:
 * {
 *   "siteId": "workiroom",
 *   "intent": "discover" | "guide",
 *   "bundleId": "workiroom-2026m01-q1-xxxx",
 *   "question": "在宅ワークの寒さ・音ストレスは◯◯か？",
 *   "note": "任意"
 * }
 */
export const createBundle = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "POST only" });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;

      const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
      const intentRaw =
        typeof body.intent === "string" ? body.intent.trim() : "";
      const intent: Intent | "" =
        intentRaw === "discover" || intentRaw === "guide" ? intentRaw : "";

      const bundleId =
        typeof body.bundleId === "string" ? body.bundleId.trim() : "";

      const question =
        typeof body.question === "string" ? body.question.trim() : "";

      const note = typeof body.note === "string" ? body.note.trim() : "";

      if (!siteId || !intent || !bundleId || !question) {
        res.status(400).json({
          ok: false,
          error:
            "siteId, intent(discover|guide), bundleId, question are required",
        });
        return;
      }

      const now = Timestamp.now();
      const nowMs = Date.now();

      // ① 同一 siteId + intent の active bundle を inactive にする
      const activeSnap = await db
        .collection("bundles")
        .where("siteId", "==", siteId)
        .where("intent", "==", intent)
        .where("status", "==", "active")
        .get();

      const batch = db.batch();

      for (const doc of activeSnap.docs) {
        // 同じ bundleId を再実行した時に、誤って inactive にしてしまうのを防ぐ
        if (doc.id === bundleId) continue;

        batch.update(doc.ref, {
          status: "inactive",
          updatedAt: now,
          updatedAtMs: nowMs,
        });
      }

      // ② 新しい bundle を active で作成（intent を必ず保存）
      const bundleRef = db.collection("bundles").doc(bundleId);
      batch.set(
        bundleRef,
        {
          siteId,
          intent,
          question,
          note: note || null,
          status: "active",
          createdAt: now,
          updatedAt: now,
          createdAtMs: nowMs,
          updatedAtMs: nowMs,
        },
        { merge: true }
      );

      // ③ sites/{siteId} に activeBundleId を保存（互換用）+ intent別も保存
      const siteRef = db.collection("sites").doc(siteId);
      batch.set(
        siteRef,
        {
          activeBundleId: bundleId, // 既存互換
          activeBundles: {
            [intent]: bundleId, // intent別に持てるように（将来用）
          },
          updatedAt: now,
          updatedAtMs: nowMs,
        },
        { merge: true }
      );

      await batch.commit();

      res.status(200).json({
        ok: true,
        siteId,
        intent,
        bundleId,
        question,
        activeBundleIdUpdated: true,
      });
    } catch (e: unknown) {
      console.error("[createBundle] error", e);
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

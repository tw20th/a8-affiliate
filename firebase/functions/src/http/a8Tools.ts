// firebase/functions/src/http/a8Tools.ts
import * as functions from "firebase-functions/v1";
import { getApps, initializeApp } from "firebase-admin/app";

if (getApps().length === 0) initializeApp();

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

/**
 * 1) data/*.yaml → Firestore 同期（siteId単位）
 *   - siteId: data/{siteId}/ 配下を対象に同期
 *   - dryRun: true で件数確認のみ
 *   - 旧パラメータ site も受け入れ可能（互換用）
 */
export const a8_syncFromFiles = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    try {
      // siteId or site（互換対応）
      const siteId = String(req.query.siteId || req.query.site || "").trim();
      if (!siteId) {
        res
          .status(400)
          .json({ ok: false, error: "siteId (or site) is required" });
        return;
      }

      // dryRun対応（オプション）
      const dryRun =
        String(req.query.dryRun ?? req.query["dry-run"] ?? "") === "true";

      // 新 ingest モジュール呼び出し
      const mod = await import("../jobs/a8/ingestFromFiles.js");
      const fn = (mod as any).ingestFromFiles || (mod as any).default;
      if (typeof fn !== "function") {
        throw new Error("ingestFromFiles not found");
      }

      // siteIdを引数として渡す
      const result = await fn({ siteId, dryRun });

      res
        .status(200)
        .json({ ok: true, siteId, source: "data/*.yaml", ...result });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

/**
 * 2) raw -> offers 正規化（既存の処理を維持）
 */
export const a8_normalizeOffers = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    try {
      const mod = await import("../jobs/a8/normalizeA8Offers.js");
      const fn = (mod as any).normalizeA8Offers || (mod as any).default;
      if (typeof fn !== "function") {
        throw new Error("normalizeA8Offers not found");
      }

      const siteId = String(req.query.siteId || "");
      const result = await fn({ siteId });
      res.status(200).json({ ok: true, result });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

/**
 * 3) 1件のオファーからブログ生成（既存ロジックを維持）
 */
export const a8_generateBlogFromOffer = functions
  .region(REGION)
  .runWith({
    secrets: ["OPENAI_API_KEY", "UNSPLASH_ACCESS_KEY"],
    timeoutSeconds: 180,
    memory: "512MB",
  })
  .https.onRequest(async (req, res) => {
    try {
      const offerId = String(req.query.offerId || "");
      const siteId = String(
        req.query.siteId || process.env.FOCUS_SITE_ID || ""
      );
      const keyword = String(req.query.keyword || "");

      if (!offerId || !siteId) {
        res
          .status(400)
          .json({ ok: false, error: "offerId and siteId are required" });
        return;
      }

      const mod = await import("../jobs/content/generateBlogFromOffer.js");
      const fn = (mod as any).generateBlogFromOffer || (mod as any).default;
      if (typeof fn !== "function") {
        throw new Error("generateBlogFromOffer not found");
      }

      const result = await fn({
        offerId,
        siteId,
        keyword,
        publish: true,
        dryRun: false,
      });

      res.status(200).json({ ok: true, result });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

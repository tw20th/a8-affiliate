import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { generateBlogContent } from "../../utils/generateBlogContent.js";
import { stripPlaceholders } from "../../utils/markdown.js";
import { analyzeSeo } from "../../lib/seo/analyzeSeo.js";

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";
const db = getFirestore();

// リライト候補のしきい値（必要に応じて環境変数で調整）
const MIN_VIEWS = Number(process.env.REWRITE_MIN_VIEWS ?? 20);
const MAX_CTR = Number(process.env.REWRITE_MAX_CTR ?? 0.02); // 2%
const MIN_AVG_TIME = Number(process.env.REWRITE_MIN_AVG ?? 30); // 秒
const MIN_SCORE = Number(process.env.REWRITE_MIN_SCORE ?? 65); // 最新スコアがこれ未満なら候補

export const scheduledRewriteLowScoreBlogs = functions
  .region(REGION)
  .runWith({ secrets: ["OPENAI_API_KEY"] })
  .pubsub.schedule("0 23 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    // 直近7日から候補抽出
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const snap = await db
      .collection("blogs")
      .where("createdAt", "<=", Date.now())
      .where("createdAt", ">=", sevenDaysAgo)
      .limit(200)
      .get();

    let candidate: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | null =
      null;

    for (const d of snap.docs) {
      const metrics = (d.get("metrics") || {}) as {
        views?: number;
        outboundClicks?: number;
        avgReadTimeSec?: number;
      };
      const views = Number(metrics.views ?? 0);
      const clicks = Number(metrics.outboundClicks ?? 0);
      const ctr = views > 0 ? clicks / views : 0;
      const avg = Number(metrics.avgReadTimeSec ?? 0);

      // 追加：最新スコアも参照
      const latestScore = Number(d.get("latestScore") ?? 0);

      // “一定以上見られているのに成果が弱い/読まれていない/スコアが低い”を優先
      const weakByBehavior =
        views >= MIN_VIEWS && (ctr <= MAX_CTR || avg <= MIN_AVG_TIME);
      const weakByScore = latestScore > 0 && latestScore < MIN_SCORE;

      if (weakByBehavior || weakByScore) {
        candidate = d;
        break;
      }
    }

    if (!candidate) return { rewritten: 0, reason: "no-candidate" };

    const data = candidate.data() as {
      siteId?: string;
      title?: string;
      content?: string;
      tags?: string[];
      offerId?: string | null;
    };
    const siteId = String(data.siteId || "");
    const title = String(data.title || "");
    const content = String(data.content || "");
    const tags = Array.isArray(data.tags) ? data.tags : [];

    // 既存テンプレを使って中身を刷新
    const out = await generateBlogContent({
      siteId,
      siteName: "Kariraku（カリラク）",
      product: { name: title, asin: (data.offerId as string) || "", tags },
      persona: "家電を借りるか迷っている人",
      pain: "料金比較・設置/回収・短期だけ使いたい",
      templateName: "blogTemplate_kariraku_service.txt",
      vars: {},
    });

    const rewritten = stripPlaceholders(out.content || "");
    const afterTitle = out.title || title;
    const afterContent = rewritten || content;
    const afterScore = analyzeSeo(`# ${afterTitle}\n\n${afterContent}`).total;

    // 履歴は配列を読み出して連結 → 直近50件に丸めて set（arrayUnionは使わない）
    const before = (candidate.get("analysisHistory") as any[]) || [];
    const limited = before
      .concat([
        {
          score: Number(afterScore ?? 0),
          suggestions: [] as string[],
          createdAt: Date.now(),
          source: "auto-rewrite",
        },
      ])
      .slice(-50);

    await candidate.ref.set(
      {
        title: afterTitle,
        content: afterContent,
        summary: out.excerpt || null,
        tags: out.tags && out.tags.length ? out.tags : tags,
        latestScore: afterScore,
        lastAnalyzedAt: Date.now(),
        updatedAt: Date.now(),
        analysisHistory: limited,
      },
      { merge: true }
    );

    return { rewritten: 1, slug: candidate.id, afterScore };
  });

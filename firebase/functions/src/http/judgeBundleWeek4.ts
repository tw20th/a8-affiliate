//firebase/functions/src/http/judgeBundleWeek4.ts
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

if (getApps().length === 0) initializeApp();
const db = getFirestore();

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

type BundleStats = {
  blogCount?: number;
  impressions?: number;
  clicks?: number;
  avgPosition?: number | null;
  publishedFrom?: number | null;
  publishedTo?: number | null;
  updatedAt?: number;
};

type Decision = "WAIT" | "KEEP" | "IMPROVE" | "DROP";

function toNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function daysBetween(aMs: number, bMs: number): number {
  const diff = Math.abs(aMs - bMs);
  return diff / (1000 * 60 * 60 * 24);
}

/**
 * 超シンプルな Week4 判定ロジック
 * - データが足りない -> WAIT
 * - 露出がない -> DROP
 * - 露出あるがクリック弱い -> IMPROVE
 * - 露出ありクリックもある -> KEEP
 */
function judge(stats: BundleStats): {
  decision: Decision;
  score: number; // 0-100
  reasons: string[];
  nextActions: string[];
  signals: {
    blogCount: number;
    impressions: number;
    clicks: number;
    avgPosition: number | null;
    daysSinceFirstPublish: number | null;
    daysSinceLastPublish: number | null;
  };
} {
  const blogCount = toNum(stats.blogCount, 0);
  const impressions = toNum(stats.impressions, 0);
  const clicks = toNum(stats.clicks, 0);
  const avgPosition =
    typeof stats.avgPosition === "number" ? stats.avgPosition : null;

  const now = Date.now();
  const first =
    typeof stats.publishedFrom === "number" ? stats.publishedFrom : null;
  const last = typeof stats.publishedTo === "number" ? stats.publishedTo : null;

  const daysSinceFirstPublish = first ? daysBetween(now, first) : null;
  const daysSinceLastPublish = last ? daysBetween(now, last) : null;

  const reasons: string[] = [];
  const nextActions: string[] = [];

  // ---- WAIT: まずデータ不足を弾く ----
  if (blogCount < 3) {
    reasons.push(
      `記事数がまだ少ない（blogCount=${blogCount}）。束（3〜4本）として判定しにくい。`
    );
    nextActions.push("同じ問いであと1〜2本だけ追加して、束を完成させる");
    nextActions.push("bundleStats をもう一度集計する");
    return {
      decision: "WAIT",
      score: 20,
      reasons,
      nextActions,
      signals: {
        blogCount,
        impressions,
        clicks,
        avgPosition,
        daysSinceFirstPublish,
        daysSinceLastPublish,
      },
    };
  }

  // ---- WAIT: 公開から日が浅すぎる（SEOは反映ラグあり） ----
  if (daysSinceFirstPublish !== null && daysSinceFirstPublish < 7) {
    reasons.push(
      `公開から日が浅い（約${daysSinceFirstPublish.toFixed(
        1
      )}日）。検索反映のラグを考えると早い。`
    );
    nextActions.push("追加投稿せず観察（B-2 OK）");
    nextActions.push("7〜14日後にもう一度 bundleStats を集計する");
    return {
      decision: "WAIT",
      score: 30,
      reasons,
      nextActions,
      signals: {
        blogCount,
        impressions,
        clicks,
        avgPosition,
        daysSinceFirstPublish,
        daysSinceLastPublish,
      },
    };
  }

  // ---- DROP: 露出がほぼない（=問いが届いてない）----
  if (impressions < 30) {
    reasons.push(
      `impressions が非常に少ない（${impressions}）。検索/Discover に乗っていない可能性が高い。`
    );
    nextActions.push(
      "問いを捨てる（DROP）か、キーワード/切り口を作り直して新しい bundle にする"
    );
    nextActions.push(
      "次の束は「キーワードを具体化」「タイトルを短く強く」「導入で悩みを明確に」を優先"
    );
    return {
      decision: "DROP",
      score: 15,
      reasons,
      nextActions,
      signals: {
        blogCount,
        impressions,
        clicks,
        avgPosition,
        daysSinceFirstPublish,
        daysSinceLastPublish,
      },
    };
  }

  // ---- IMPROVE: 露出はあるがクリックが弱い ----
  const ctr = impressions > 0 ? clicks / impressions : 0;

  // position が悪い場合は SEO 的に「中身改善」寄り
  const positionBad = avgPosition !== null && avgPosition > 25;

  // CTR が弱い場合は「タイトル/導入」改善寄り
  const ctrWeak = ctr < 0.01; // 1% 未満

  if (clicks === 0 || ctrWeak || positionBad) {
    reasons.push(
      `露出はある（impressions=${impressions}）が、反応が弱い（clicks=${clicks}, CTR=${(
        ctr * 100
      ).toFixed(2)}%）。`
    );
    if (avgPosition !== null)
      reasons.push(`平均掲載順位が高め（avgPosition=${avgPosition}）。`);

    nextActions.push(
      "同じ問いで「改善束」を作る（IMPROVE）：タイトル案を3パターン切り替える"
    );
    nextActions.push(
      "導入1段落を“悩みの明確化”に寄せる（誰の何がつらいかを先に言う）"
    );
    nextActions.push(
      "内部リンクを束の中で相互に1〜2本ずつ追加する（/blog/[slug]）"
    );

    const scoreBase = 55;
    const score =
      Math.min(
        85,
        Math.max(
          35,
          scoreBase +
            (clicks > 0 ? 10 : 0) +
            (avgPosition !== null ? Math.max(0, 20 - avgPosition) : 0)
        )
      ) | 0;

    return {
      decision: "IMPROVE",
      score,
      reasons,
      nextActions,
      signals: {
        blogCount,
        impressions,
        clicks,
        avgPosition,
        daysSinceFirstPublish,
        daysSinceLastPublish,
      },
    };
  }

  // ---- KEEP: 露出もクリックもある ----
  reasons.push(
    `露出とクリックが取れている（impressions=${impressions}, clicks=${clicks}, CTR=${(
      ctr * 100
    ).toFixed(2)}%）。`
  );
  if (avgPosition !== null)
    reasons.push(`平均掲載順位も悪くない（avgPosition=${avgPosition}）。`);

  nextActions.push("この問いは KEEP：同テーマで派生問い（深掘り）を作る");
  nextActions.push("束の中で最もクリックが取れている記事の型をテンプレ化する");
  nextActions.push("Week4 は観察を優先し、余計に触りすぎない（B-2 OK）");

  const score =
    Math.min(
      95,
      Math.max(
        60,
        60 +
          Math.min(20, Math.floor((clicks / 3) * 5)) +
          (avgPosition !== null ? Math.max(0, 25 - avgPosition) : 0)
      )
    ) | 0;

  return {
    decision: "KEEP",
    score,
    reasons,
    nextActions,
    signals: {
      blogCount,
      impressions,
      clicks,
      avgPosition,
      daysSinceFirstPublish,
      daysSinceLastPublish,
    },
  };
}

/**
 * GET /admin/judgeBundleWeek4?bundleId=xxx
 */
export const judgeBundleWeek4 = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    try {
      const bundleId = String(req.query.bundleId || "").trim();
      if (!bundleId) {
        res.status(400).json({ ok: false, error: "bundleId required" });
        return;
      }

      const bundleSnap = await db.collection("bundles").doc(bundleId).get();
      if (!bundleSnap.exists) {
        res
          .status(404)
          .json({ ok: false, error: "bundle not found", bundleId });
        return;
      }

      const data = bundleSnap.data() as
        | { stats?: BundleStats; siteId?: string; question?: string }
        | undefined;
      const stats = (data?.stats ?? {}) as BundleStats;

      const result = judge(stats);

      res.status(200).json({
        ok: true,
        bundleId,
        siteId: data?.siteId ?? null,
        question: data?.question ?? null,
        decision: result.decision,
        score: result.score,
        reasons: result.reasons,
        nextActions: result.nextActions,
        signals: result.signals,
        stats,
      });
    } catch (e: any) {
      console.error("[judgeBundleWeek4] error", e);
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

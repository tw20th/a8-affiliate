import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { analyzeSeo } from "../../lib/seo/analyzeSeo.js"; // ← alias = analyzeMarkdown

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";
const TZ = "Asia/Tokyo";
const db = getFirestore();

// 当日0:00 JST の epoch(ms)
function startOfTodayJST(): number {
  const now = new Date();
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  jst.setHours(0, 0, 0, 0);
  return jst.getTime();
}

function suggestionsFromChecks(
  checks: Record<string, boolean | number>
): string[] {
  const s: string[] = [];
  if (!checks.hasHeadings) s.push("H2/H3の見出しを追加して構造化");
  if (!checks.hasList) s.push("箇条書きで要点を整理");
  if (!checks.hasInternalLinks) s.push("関連記事への内部リンクを追加");
  if (!checks.hasFAQ) s.push("FAQを3問追加");
  if (!checks.hasCTA) s.push("CTAリンクを本文中に追加");
  if (!checks.hasTable) s.push("比較表（表組み）を追加");
  return s.slice(0, 8);
}

/** 夜 20:00 … 当日作成記事を自動分析し、blogs.analysisHistory に追記 */
export const scheduledAnalyzeBlogsNight = functions
  .region(REGION)
  // OpenAIは使わないローカル分析なので secrets 不要
  .runWith({})
  .pubsub.schedule("0 20 * * *")
  .timeZone(TZ)
  .onRun(async () => {
    const since = startOfTodayJST();
    const snap = await db
      .collection("blogs")
      .where("createdAt", ">=", since)
      .get();

    if (snap.empty) return { analyzed: 0 };

    let analyzed = 0;
    for (const d of snap.docs) {
      const data = d.data() as { title?: string; content?: string };
      const title = String(data.title || "");
      const content = String(data.content || "");

      // Markdownベースの軽量スコアリング
      const seo = analyzeSeo(`# ${title}\n\n${content}`);
      const entry = {
        score: Number(seo.total ?? 0),
        checks: seo.checks || {},
        suggestions: suggestionsFromChecks(seo.checks || {}),
        titleSuggestion: null as string | null,
        outlineSuggestion: null as string | null,
        createdAt: Date.now(),
        source: "auto-night",
      };

      const before = d.get("analysisHistory") as any[] | undefined;
      const hist = (Array.isArray(before) ? before : []).concat([entry]);
      // 履歴は直近50件まで（必要なら値は調整）
      const limited = hist.slice(-50);

      await d.ref.set(
        {
          // 履歴を上書き（arrayUnion は去重不可＆順序管理できないためここは set で統一）
          analysisHistory: limited,
          // 参照用の最新スコア
          latestScore: entry.score,
          lastAnalyzedAt: entry.createdAt,
          updatedAt: entry.createdAt,
        },
        { merge: true }
      );
      analyzed++;
    }
    return { analyzed };
  });

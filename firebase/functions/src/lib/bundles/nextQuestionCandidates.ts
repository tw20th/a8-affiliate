//firebase/functions/src/lib/bundles/nextQuestionCandidates.ts
import { z } from "zod";

export type BundleDecision = "WAIT" | "KEEP" | "IMPROVE" | "DROP";

export type BundleStats = {
  blogCount: number;
  impressions: number;
  clicks: number;
  avgPosition: number | null;
  publishedFrom: number | null;
  publishedTo: number | null;
};

export type Candidate = {
  id: string; // stable-ish id
  template: 1 | 2 | 3 | 4;
  question: string;
  intent: string; // ねらい（短文）
  seedKeyword: string;
};

const CandidateSchema = z.object({
  id: z.string(),
  template: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  question: z.string().min(1),
  intent: z.string().min(1),
  seedKeyword: z.string().min(1),
});

const CandidatesSchema = z.array(CandidateSchema).min(1).max(5);

/**
 * siteごとの「ズラし辞書」
 * A: よくある思い込み/表層
 * B: 次に見たい軸/奥
 */
type ShiftPair = { a: string; b: string; intent: string };

const SHIFT_PAIRS: Record<string, ShiftPair[]> = {
  workiroom: [
    { a: "椅子", b: "光", intent: "疲れの原因を環境に寄せて掘る" },
    { a: "集中力", b: "回復", intent: "頑張り方ではなく整え方へ" },
    { a: "音", b: "反響", intent: "機材より空間の要因を疑う" },
    { a: "姿勢", b: "緊張", intent: "身体より“力み”を見に行く" },
  ],
  hadasmooth: [
    { a: "保湿", b: "洗い方", intent: "足すより減らす視点へ" },
    { a: "スキンケア", b: "睡眠", intent: "生活リズム側から整える" },
    { a: "乾燥", b: "ストレス", intent: "肌以外の揺らぎ要因を拾う" },
    { a: "成分", b: "使い方", intent: "選び方より扱い方へ" },
  ],
  kariraku: [
    { a: "買う", b: "試す", intent: "失敗コストを減らす方向へ" },
    { a: "性能", b: "生活の手間", intent: "スペックより運用負担へ" },
    { a: "初期費用", b: "意思決定疲れ", intent: "迷いの正体を言語化する" },
    { a: "最適解", b: "ちょうどいい", intent: "完璧より現実解へ" },
  ],
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function take<T>(arr: T[], n: number): T[] {
  return arr.slice(0, Math.max(0, n));
}

function makeId(prefix: string, i: number): string {
  return `${prefix}-${i + 1}-${Date.now()}`;
}

/**
 * テンプレ（ゆずは世界観）固定 1〜4
 */
function applyTemplate(params: {
  template: 1 | 2 | 3 | 4;
  a?: string;
  b?: string;
  topic: string;
}): string {
  const { template, a, b, topic } = params;

  // topicが空でも破綻しないように
  const t = topic.trim() || "この悩み";

  if (template === 1) {
    const A = (a ?? "原因").trim() || "原因";
    const B = (b ?? "別の要因").trim() || "別の要因";
    return `${t}は「${A}」だと思っていたけど、もしかしたら「${B}」が原因かもしれない。`;
  }

  if (template === 2) {
    const B = (b ?? "別のつらさ").trim() || "別のつらさ";
    return `${t}で悩んでいる人は多いけど、本当につらいのは「${B}」かもしれない。`;
  }

  if (template === 3) {
    const A = (a ?? "頑張ること").trim() || "頑張ること";
    const B = (b ?? "逆効果").trim() || "逆効果";
    return `${t}で「${A}」を頑張るほど、かえって「${B}」になっていないだろうか。`;
  }

  // template 4
  return `${t}って、本当にそれだけが理由だろうか。`;
}

export function buildNextCandidates(params: {
  siteId: string;
  decision: BundleDecision;
  bundleQuestion: string;
  seedKeywords: string[]; // 重要：ここに候補軸を入れる
}): Candidate[] {
  const { siteId, decision, bundleQuestion, seedKeywords } = params;

  const pairs = SHIFT_PAIRS[siteId] ?? SHIFT_PAIRS.workiroom;
  const seeds = uniq(
    seedKeywords.map((s) => s.trim()).filter((s) => s.length > 0)
  );

  // 候補数：基本3、DROPのみ最大5
  const max = decision === "DROP" ? 5 : 3;

  const templatesByDecision: Record<BundleDecision, (1 | 2 | 3 | 4)[]> = {
    KEEP: [1, 4],
    IMPROVE: [2, 4],
    DROP: [3, 4],
    WAIT: [4],
  };

  const templates = templatesByDecision[decision];

  const out: Candidate[] = [];

  const topicBase = bundleQuestion.trim() || (seeds[0] ?? "このテーマ");

  // まずpairベースで作る（A/Bが必要なテンプレ用）
  for (let i = 0; i < pairs.length && out.length < max; i++) {
    const p = pairs[i];
    const template = templates[i % templates.length];

    const topic = `${topicBase}（${p.a}→${p.b}）`;

    const q = applyTemplate({
      template,
      a: p.a,
      b: p.b,
      topic,
    });

    out.push({
      id: makeId(`${decision.toLowerCase()}-${siteId}`, out.length),
      template,
      question: q,
      intent: p.intent,
      seedKeyword: seeds[0] ?? topicBase,
    });
  }

  // 次に seedKeywords を混ぜて追加（テンプレ4中心）
  for (let i = 0; i < seeds.length && out.length < max; i++) {
    const seed = seeds[i];
    const template = 4 as const; // ✅ prefer-as-const 対応
    out.push({
      id: makeId(`${decision.toLowerCase()}-${siteId}`, out.length),
      template,
      question: applyTemplate({ template, topic: seed }),
      intent: "切り口を変えて反応を探す",
      seedKeyword: seed,
    });
  }

  // 3〜5に収める
  const final = take(out, max);

  // バリデーション（壊れたら落ちるので、実装側で try/catch 推奨）
  return CandidatesSchema.parse(final);
}

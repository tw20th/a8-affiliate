// firebase/functions/src/lib/bundles/slackMessage.ts
import type { Candidate } from "./nextQuestionCandidates.js";

export type SlackBlock = Record<string, unknown>;

export type SlackPayload = {
  text: string;
  blocks?: SlackBlock[];
  // response_url へ返すときに使える（ephemeral/in_channel）
  response_type?: "ephemeral" | "in_channel";
};

export function buildBundleReviewSlackPayload(params: {
  siteId: string;
  bundleId: string;
  question: string;
  decision: "WAIT" | "KEEP" | "IMPROVE" | "DROP";
  reasons: string[];
  stats: {
    blogCount: number;
    impressions: number;
    clicks: number;
    avgPosition: number | null;
  };
  candidates: Array<Pick<Candidate, "question" | "intent" | "template">>;

  /**
   * ✅ Incoming Webhook に投げる場合 true
   * - Webhookは “ボタンを押して処理” の用途に向かないので actions を出さない
   * ✅ Interactivity (response_url) に返す場合 false
   * - actions(button) を出す
   */
  forWebhook?: boolean;
}): SlackPayload {
  const {
    siteId,
    bundleId,
    question,
    decision,
    reasons,
    stats,
    candidates,
    forWebhook = true,
  } = params;

  const header = `🧭 Week4 Review: ${decision}`;
  const summaryText = [
    header,
    `site: ${siteId}`,
    `bundleId: ${bundleId}`,
    `問い: ${question}`,
    `stats: blogs=${stats.blogCount}, imp=${stats.impressions}, click=${
      stats.clicks
    }, pos=${stats.avgPosition ?? "-"}`,
    reasons.length ? `reasons: ${reasons.join(" / ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const blocks: SlackBlock[] = [
    { type: "header", text: { type: "plain_text", text: header } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*サイト*：${siteId}\n*束*：${bundleId}\n*問い*：${question}`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*記事数*\n${stats.blogCount}` },
        { type: "mrkdwn", text: `*impressions*\n${stats.impressions}` },
        { type: "mrkdwn", text: `*clicks*\n${stats.clicks}` },
        { type: "mrkdwn", text: `*avgPosition*\n${stats.avgPosition ?? "-"}` },
      ],
    },
    ...(reasons.length
      ? [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*理由*\n• ${reasons.join("\n• ")}` },
          },
        ]
      : []),
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: `*次の問い候補*` } },
  ];

  const top = candidates.slice(0, 5);

  // ✅ response_url へ返す（Interactivity）時だけボタンを出す
  if (!forWebhook) {
    const buttons = top.map((_, i) => ({
      type: "button",
      text: { type: "plain_text", text: `${i + 1}`, emoji: true },
      style: "primary",
      action_id: `start_bundle_candidate_${i}`, // ✅ユニークにする（invalid_blocks回避）
      value: JSON.stringify({ bundleId, candidateIndex: i }),
    }));

    if (buttons.length) blocks.push({ type: "actions", elements: buttons });
  }

  const lines = top
    .map((c, i) => `*${i + 1}.*（t${c.template}）${c.question}\n_${c.intent}_`)
    .join("\n\n");

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: lines || "（候補なし）" },
  });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: forWebhook
          ? "※ 候補開始は Interactivity（ボタン）側で行います"
          : "※ ボタン押下は Interactivity を使用します（Request URL に /slackActions）",
      },
    ],
  });

  return { text: summaryText, blocks };
}

export function buildBundleStartedSlackResponse(params: {
  siteId: string;
  newBundleId: string;
  intent: "discover" | "guide";
  question: string;
  template: 1 | 2 | 3 | 4;
  startedBy?: string;
}): SlackPayload {
  const { siteId, newBundleId, intent, question, template, startedBy } = params;

  const header = "✅ 束を開始しました";

  const blocks: SlackBlock[] = [
    { type: "header", text: { type: "plain_text", text: header } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*サイト*\n${siteId}` },
        { type: "mrkdwn", text: `*intent*\n${intent}` },
        { type: "mrkdwn", text: `*template*\n${template}` },
        { type: "mrkdwn", text: `*bundleId*\n${newBundleId}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*問い*\n「${question}」` },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text:
            startedBy && startedBy.trim()
              ? `開始者：${startedBy}`
              : "開始者：unknown",
        },
      ],
    },
  ];

  return {
    text: `${header}\nsite=${siteId}\nbundleId=${newBundleId}`,
    blocks,
  };
}

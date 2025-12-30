type Candidate = {
  question: string;
};

export function buildBundleReviewBlocks(params: {
  siteId: string;
  bundleId: string;
  question: string;
  candidates: Candidate[];
}) {
  const { siteId, bundleId, question, candidates } = params;

  const buttons = candidates.slice(0, 5).map((c, i) => ({
    type: "button",
    text: {
      type: "plain_text",
      text: `①②③④⑤`.charAt(i) + " " + c.question.slice(0, 20),
      emoji: true,
    },
    value: JSON.stringify({
      bundleId,
      candidateIndex: i,
    }),
    action_id: "start_bundle_from_candidate",
  }));

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🔍 *束のレビュー結果*\n*サイト*：${siteId}\n*問い*：${question}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*💡 次の問い候補（押すと開始）*",
      },
    },
    {
      type: "actions",
      elements: buttons,
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "※ 判断はあなた、開始だけを仕組みに任せています",
        },
      ],
    },
  ];
}

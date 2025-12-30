// firebase/functions/src/services/slack/webhook.ts
export async function postToSlack(payload: unknown) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) throw new Error("Missing SLACK_WEBHOOK_URL");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[postToSlack] failed", {
      status: res.status,
      body,
      payload, // ✅ これ
    });
    throw new Error(`Slack webhook failed: ${res.status} ${body}`);
  }
}

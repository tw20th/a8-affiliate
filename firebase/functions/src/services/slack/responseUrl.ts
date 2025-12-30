import { SlackPayload } from "../../lib/bundles/slackMessage.js";

export async function postToSlackResponseUrl(params: {
  responseUrl: string;
  payload: SlackPayload;
}): Promise<void> {
  const { responseUrl, payload } = params;

  const res = await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      replace_original: true,
      response_type: "in_channel",
      ...payload,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Slack response_url failed: ${res.status} ${text}`);
  }
}

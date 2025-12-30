// firebase/functions/src/http/slackActions.ts
import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

import { verifySlackSignature } from "../services/slack/verifySignature.js";
import { postToSlackResponseUrl } from "../services/slack/responseUrl.js";
import { startBundleFromCandidateLogic } from "../lib/bundles/startBundleFromCandidateLogic.js";
import { buildBundleStartedSlackResponse } from "../lib/bundles/slackMessage.js";

if (getApps().length === 0) initializeApp();
const db = getFirestore();

const REGION = process.env.FUNCTIONS_REGION || "asia-northeast1";

/**
 * Slack Interactivity Request URL
 * 例: https://<region>-<project>.cloudfunctions.net/slackActions
 */
export const slackActions = functions
  .region(REGION)
  .runWith({ secrets: ["SLACK_SIGNING_SECRET"] })
  .https.onRequest(async (req, res) => {
    // Slack は x-www-form-urlencoded
    const rawBody =
      typeof req.rawBody === "string"
        ? req.rawBody
        : req.rawBody?.toString("utf8") ?? "";

    const signature = req.header("X-Slack-Signature") ?? "";
    const timestamp = req.header("X-Slack-Request-Timestamp") ?? "";

    const signingSecret = process.env.SLACK_SIGNING_SECRET ?? "";

    const ok = verifySlackSignature({
      signingSecret,
      rawBody,
      timestamp,
      signature,
    });

    if (!ok) {
      res.status(401).send("invalid signature");
      return;
    }

    // form から payload を取り出す（ここまではACK前に最低限必要）
    const payloadStr =
      typeof (req.body as { payload?: unknown } | undefined)?.payload ===
      "string"
        ? (req.body as { payload: string }).payload
        : extractPayloadFromRawForm(rawBody);

    if (!payloadStr) {
      res.status(400).send("missing payload");
      return;
    }

    // ✅ 即ACK（3秒ルール対策）
    // ※ここでは parse 前なので、軽い固定文だけ返す
    res.status(200).json({
      response_type: "ephemeral",
      text: "OK! 反映中…",
    });

    // 以降は「Slackへは response_url 経由で返す」だけ（resはもう触らない）
    let responseUrl: string | undefined;

    try {
      const payload = JSON.parse(payloadStr) as {
        type?: string;
        user?: { username?: string; name?: string };
        actions?: Array<{ action_id?: string; value?: string }>;
        response_url?: string;
      };

      responseUrl = payload.response_url;
      const action = payload.actions?.[0];

      if (
        !responseUrl ||
        !action ||
        !String(action.action_id ?? "").startsWith("start_bundle_candidate")
      ) {
        return;
      }

      // value: {"bundleId":"...","candidateIndex":0}
      let v: { bundleId?: string; candidateIndex?: number } = {};
      try {
        v = JSON.parse(action.value ?? "{}");
      } catch {
        v = {};
      }

      const bundleId = String(v.bundleId ?? "").trim();
      const candidateIndex = Number(v.candidateIndex);

      if (!bundleId || !Number.isFinite(candidateIndex)) {
        await postToSlackResponseUrl({
          responseUrl,
          payload: {
            response_type: "ephemeral",
            text: "⚠️ 候補の情報が読み取れませんでした（bundleId / candidateIndex）",
          },
        });
        return;
      }

      const started = await startBundleFromCandidateLogic({
        db,
        bundleId,
        candidateIndex,
      });

      const startedBy =
        payload.user?.username ?? payload.user?.name ?? "unknown";

      const slackPayload = buildBundleStartedSlackResponse({
        siteId: started.siteId,
        newBundleId: started.newBundleId,
        intent: started.intent,
        question: started.question,
        template: started.template,
        startedBy,
      });

      await postToSlackResponseUrl({
        responseUrl,
        payload: slackPayload,
      });
    } catch (e) {
      console.error("[slackActions] failed", e);

      // 失敗も response_url に返すと親切（response_url が取れている時だけ）
      if (!responseUrl) return;

      try {
        await postToSlackResponseUrl({
          responseUrl,
          payload: {
            response_type: "ephemeral",
            text: "⚠️ 束の開始に失敗しました",
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `⚠️ *束の開始に失敗しました*\n\`${String(e)}\``,
                },
              },
              {
                type: "context",
                elements: [
                  {
                    type: "mrkdwn",
                    text: "もう一度ボタンを押すか、時間を置いて再実行してください。",
                  },
                ],
              },
            ],
          },
        });
      } catch {
        // noop
      }
    }
  });

// rawBody (= "payload=....") から payload を抜く保険
function extractPayloadFromRawForm(raw: string): string | null {
  // payload=<urlencoded json>
  const m = raw.match(/(?:^|&)payload=([^&]+)/);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch {
    return null;
  }
}

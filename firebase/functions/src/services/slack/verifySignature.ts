import crypto from "node:crypto";

export function verifySlackSignature(params: {
  signingSecret: string;
  rawBody: string;
  timestamp: string | undefined;
  signature: string | undefined;
}): boolean {
  const { signingSecret, rawBody, timestamp, signature } = params;

  if (!timestamp || !signature) return false;

  // replay attack 対策（5分）
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 60 * 5) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(base, "utf8")
    .digest("hex");

  const expected = `v0=${hmac}`;

  // timing-safe compare
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}

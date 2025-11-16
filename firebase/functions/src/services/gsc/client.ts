// firebase/functions/src/services/gsc/client.ts
import { getApps, initializeApp } from "firebase-admin/app";
if (getApps().length === 0) initializeApp();

export async function makeGscJwt(saJson: string) {
  const { google } = await import("googleapis"); // ★ここが遅延import
  const creds = JSON.parse(saJson);
  const jwt = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  return google.searchconsole({ version: "v1", auth: jwt });
}

export function resolvePropertyUrl(site: {
  domain?: string;
  gsc?: { propertyUrl?: string };
}) {
  if (site?.gsc?.propertyUrl) return site.gsc.propertyUrl;
  if (site?.domain) {
    const host = site.domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return `https://${host}/`;
  }
  throw new Error("Cannot resolve GSC propertyUrl from site config");
}

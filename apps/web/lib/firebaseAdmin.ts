// apps/web/lib/firebaseAdmin.ts
import {
  getApps,
  getApp,
  initializeApp,
  applicationDefault,
  cert,
  App,
} from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/**
 * Next.js (app router) の server 側でだけ import してください。
 * 環境変数は apps/web/.env.local に配置します。
 *
 * FIREBASE_PROJECT_ID=...
 * FIREBASE_CLIENT_EMAIL=...
 * FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 */
let _app: App | undefined;

export function adminApp(): App {
  if (!_app) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // GitHub Actions 等で \n がエスケープされている場合に復元
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(
      /\\n/g,
      "\n"
    );

    _app = getApps().length
      ? getApp()
      : initializeApp({
          credential:
            privateKey && clientEmail
              ? cert({ projectId, clientEmail, privateKey })
              : applicationDefault(),
          projectId,
        });
  }
  return _app!;
}

export const adminDb = () => getFirestore(adminApp());
export { FieldValue };

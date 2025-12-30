// firebase/functions/src/lib/bundles/getActiveBundle.ts
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * intent ごとに「active な bundleId」を返す
 * - decideBundleSlot を正として使う設計でも、外部から参照する用途で残しておく
 */
export async function getActiveBundleId(
  siteId: string,
  intent: "guide" | "discover"
): Promise<string | null> {
  const snap = await db
    .collection("bundles")
    .where("siteId", "==", siteId)
    .where("intent", "==", intent)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].id;
}

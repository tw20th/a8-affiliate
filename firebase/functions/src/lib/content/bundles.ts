//firebase/functions/src/lib/content/bundles.ts
import { Firestore } from "firebase-admin/firestore";

export type BundleDecision =
  | {
      ok: true;
      bundleId: string;
      bundleIndex: number;
    }
  | {
      ok: false; // ← もう投稿しない
      reason: "bundle_completed";
    };

/**
 * その site / intent の「今アクティブな問い（bundle）」を判定する
 */
export async function decideBundleSlot(params: {
  db: Firestore;
  siteId: string;
  intent: "guide" | "discover";
  maxPerBundle?: number; // default 4
}): Promise<BundleDecision> {
  const { db, siteId, intent } = params;
  const max = params.maxPerBundle ?? 4;

  // 現在アクティブな bundle を取得
  const bundleSnap = await db
    .collection("bundles")
    .where("siteId", "==", siteId)
    .where("intent", "==", intent)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (bundleSnap.empty) {
    // bundle が無い → 投稿しない（観察フェーズ）
    return { ok: false, reason: "bundle_completed" };
  }

  const bundleDoc = bundleSnap.docs[0];
  const bundleId = bundleDoc.id;

  // その bundle で何本出たか
  const countSnap = await db
    .collection("blogs")
    .where("siteId", "==", siteId)
    .where("bundleId", "==", bundleId)
    .get();

  const count = countSnap.size;

  if (count >= max) {
    // bundle 完了 → bundle を close
    await bundleDoc.ref.set(
      {
        status: "completed",
        completedAt: Date.now(),
      },
      { merge: true }
    );

    return { ok: false, reason: "bundle_completed" };
  }

  return {
    ok: true,
    bundleId,
    bundleIndex: count + 1,
  };
}

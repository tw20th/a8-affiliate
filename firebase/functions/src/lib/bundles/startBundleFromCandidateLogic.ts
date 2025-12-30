import { Timestamp } from "firebase-admin/firestore";

export type StartBundleResult = {
  ok: true;
  siteId: string;
  intent: "discover" | "guide";
  newBundleId: string;
  question: string;
  template: 1 | 2 | 3 | 4;
};

export async function startBundleFromCandidateLogic(params: {
  db: FirebaseFirestore.Firestore;
  bundleId: string;
  candidateIndex: number;
}): Promise<StartBundleResult> {
  const { db, bundleId, candidateIndex } = params;

  const baseRef = db.collection("bundles").doc(bundleId);
  const baseSnap = await baseRef.get();
  if (!baseSnap.exists) throw new Error("bundle not found");

  const base = baseSnap.data() as {
    siteId: string;
    intent: "discover" | "guide";
    nextCandidates?: {
      items?: Array<{
        question: string;
        intent: string;
        template: number;
      }>;
    };
  };

  const items = base.nextCandidates?.items ?? [];
  const picked = items[candidateIndex];
  if (!picked) throw new Error("candidateIndex out of range");

  // template を 1|2|3|4 に寄せる
  const template = (
    picked.template === 1 ||
    picked.template === 2 ||
    picked.template === 3 ||
    picked.template === 4
      ? picked.template
      : 4
  ) as 1 | 2 | 3 | 4;

  const now = new Date();
  const ym = `${now.getFullYear()}m${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
  const newBundleId = `${base.siteId}-${ym}-${base.intent}-${Date.now()}`;

  const nowTs = Timestamp.now();
  const nowMs = Date.now();

  // 既存 active を inactive に（intent 単位）
  const activeSnap = await db
    .collection("bundles")
    .where("siteId", "==", base.siteId)
    .where("intent", "==", base.intent)
    .where("status", "==", "active")
    .get();

  const batch = db.batch();
  for (const d of activeSnap.docs) {
    batch.update(d.ref, {
      status: "inactive",
      updatedAt: nowTs,
      updatedAtMs: nowMs,
    });
  }

  // 新 bundle 作成
  const newRef = db.collection("bundles").doc(newBundleId);
  batch.set(
    newRef,
    {
      siteId: base.siteId,
      intent: base.intent,
      question: String(picked.question ?? ""),
      status: "active",
      createdAt: nowTs,
      updatedAt: nowTs,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
      startedFrom: {
        baseBundleId: bundleId,
        candidateIndex,
        template,
      },
    },
    { merge: true }
  );

  // sites へ反映（互換）
  const siteRef = db.collection("sites").doc(base.siteId);
  batch.set(
    siteRef,
    {
      activeBundleId: newBundleId,
      activeBundles: { [base.intent]: newBundleId },
      updatedAt: nowTs,
      updatedAtMs: nowMs,
    },
    { merge: true }
  );

  await batch.commit();

  return {
    ok: true,
    siteId: base.siteId,
    intent: base.intent,
    newBundleId,
    question: String(picked.question ?? ""),
    template,
  };
}

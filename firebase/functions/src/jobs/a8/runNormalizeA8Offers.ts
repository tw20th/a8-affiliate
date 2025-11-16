// firebase/functions/src/jobs/a8/runNormalizeA8Offers.ts
import { getApps, initializeApp } from "firebase-admin/app";
import { normalizeA8Offers } from "./normalizeA8Offers.js";

if (getApps().length === 0) {
  initializeApp();
}

async function main() {
  try {
    const result = await normalizeA8Offers();
    console.log("[runNormalizeA8Offers] done:", result);
    process.exit(0);
  } catch (err) {
    console.error("[runNormalizeA8Offers] error:", err);
    process.exit(1);
  }
}

main();

// packages/content-engine/scripts/copy-templates.mjs
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(); // packages/content-engine を起点にする
const srcDir = path.join(rootDir, "templates");
const outDir = path.join(rootDir, "dist", "templates");

if (!fs.existsSync(srcDir)) {
  throw new Error(`[content-engine] templates dir not found: ${srcDir}`);
}

fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".txt"));
if (files.length === 0) {
  console.warn("[content-engine] no template files found in templates/");
}

for (const name of files) {
  fs.copyFileSync(path.join(srcDir, name), path.join(outDir, name));
}

console.log("[content-engine] templates copied:", files);

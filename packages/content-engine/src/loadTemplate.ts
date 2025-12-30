// packages/content-engine/src/loadTemplate.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cache = new Map<string, string>();

export async function loadTemplateText(templateName: string): Promise<string> {
  const key = String(templateName || "").trim();
  if (!key) throw new Error("[content-engine] templateName is required");

  const cached = cache.get(key);
  if (cached) return cached;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // ✅ dist/loadTemplate.js -> dist/templates/<name>
  const p = path.resolve(__dirname, "templates", key);

  const text = await readFile(p, "utf8");
  cache.set(key, text);
  return text;
}

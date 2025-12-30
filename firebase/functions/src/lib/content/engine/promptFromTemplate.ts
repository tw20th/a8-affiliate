// firebase/functions/src/lib/content/engine/promptFromTemplate.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export type TemplateVars = Record<string, unknown>;

export type BuildPromptInput = {
  siteId: string;
  siteName?: string;
  product?: { name: string; asin: string; tags?: string[] };
  persona?: string;
  pain?: string;
  templateName?: string; // e.g. blogTemplate_discover.txt
  vars?: TemplateVars;
};

function resolvePromptsDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // src/lib/content/engine -> ../../prompts
  return path.resolve(__dirname, "../../prompts");
}

function readTextSafe(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function resolveByPath(obj: unknown, key: string): unknown {
  const parts = key
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  let cur: unknown = obj;
  for (const p of parts) {
    if (Array.isArray(cur)) {
      const idx = Number(p);
      if (Number.isNaN(idx) || idx < 0 || idx >= cur.length) return "";
      cur = cur[idx];
      continue;
    }
    if (typeof cur !== "object" || cur === null) return "";
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur ?? "";
}

/** {{#each arrPath}} ... {{this.xxx}} ... {{/each}} */
function renderEachBlocks(tpl: string, vars: Record<string, unknown>): string {
  const eachRe =
    /\{\{\s*#each\s+([a-zA-Z0-9_.\[\]-]+)\s*\}\}([\s\S]*?)\{\{\s*\/each\s*\}\}/g;

  return tpl.replace(eachRe, (_m: string, arrPath: string, inner: string) => {
    const resolved = resolveByPath(vars, arrPath);
    const arr = Array.isArray(resolved) ? (resolved as unknown[]) : null;
    if (!arr || arr.length === 0) return "";

    return arr
      .map((item) => {
        let block = inner.replace(
          /\{\{\s*this\.([a-zA-Z0-9_.\[\]-]+)\s*\}\}/g,
          (_m2: string, k: string) => toStr(resolveByPath(item, k))
        );

        // {{key}} の fallback: item -> vars
        block = block.replace(
          /\{\{\s*([a-zA-Z0-9_.\[\]-]+)\s*\}\}/g,
          (_m3: string, k: string) => {
            const vItem = resolveByPath(item, k);
            if (vItem !== "" && vItem !== undefined && vItem !== null) {
              return toStr(vItem);
            }
            return toStr(resolveByPath(vars, k));
          }
        );
        return block;
      })
      .join("");
  });
}

function replaceVars(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(
    /\{\{\s*([a-zA-Z0-9_.\[\]-]+)\s*\}\}/g,
    (_m: string, key: string) => toStr(resolveByPath(vars, key))
  );
}

/** テンプレ名を選ぶ（基本は templateName 指定優先。無ければ painGuide をフォールバック） */
function chooseTemplateFilename(templateName?: string): string {
  if (templateName && templateName.endsWith(".txt")) return templateName;
  // 最後の砦：既存の安全なデフォルト
  return "blogTemplate_painGuide.txt";
}

export function buildPromptFromTemplate(input: BuildPromptInput): string {
  const promptsDir = resolvePromptsDir();
  const filename = chooseTemplateFilename(input.templateName);
  const fullpath = path.join(promptsDir, filename);

  const tpl = readTextSafe(fullpath);
  if (!tpl) {
    const pname = input.product?.name ?? "(no product)";
    return `# ${pname} の記事テンプレート\n${input.pain ?? ""}`;
  }

  const baseVars: TemplateVars = {
    "site.id": input.siteId,
    "site.displayName": input.siteName ?? "",
    productName: input.product?.name ?? "",
    asin: input.product?.asin ?? "",
    persona: input.persona ?? "",
    pain: input.pain ?? "",
    ...(input.vars ?? {}),
  };

  const rendered = replaceVars(renderEachBlocks(tpl, baseVars), baseVars);
  return rendered.trim();
}

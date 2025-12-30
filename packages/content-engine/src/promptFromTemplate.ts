// packages/content-engine/src/promptFromTemplate.ts
import { loadTemplateText } from "./loadTemplate.js";
import type { TemplateVars } from "./types.js";

/**
 * templateName + vars から「テンプレ文字列」を作る
 * - Node環境で packages/content-engine/templates/ から読む
 * - 置換はシンプル（{{key}}）
 */
export async function promptFromTemplate(
  templateName: string,
  vars: TemplateVars
): Promise<string> {
  const template = await loadTemplateText(templateName);
  return renderTemplate(template, vars);
}

/* -----------------------------
 * tiny template renderer
 * ----------------------------- */

/**
 * {{a.b.c}} の簡易置換（未解決は空文字）
 * - any禁止のため unknown を丁寧に辿る
 */
function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) => {
    const v = getByPath(vars, String(key));
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  });
}

function getByPath(obj: Record<string, unknown>, pathStr: string): unknown {
  const parts = pathStr.split(".").filter((p) => p.length > 0);
  let cur: unknown = obj;

  for (const p of parts) {
    if (typeof cur !== "object" || cur === null) return undefined;
    const rec = cur as Record<string, unknown>;
    cur = rec[p];
  }
  return cur;
}

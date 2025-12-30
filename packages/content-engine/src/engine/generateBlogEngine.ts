// packages/content-engine/src/engine/generateBlogEngine.ts
import type { TemplateVars } from "../types.js";
import { promptFromTemplate } from "../promptFromTemplate.js";
import { parseAiBlogOutput } from "./parseAiBlogOutput.js";

export type GenerateBlogEngineParams = {
  siteId: string;
  siteName?: string;

  templateName: string;

  // 既存コード互換：generateBlogContent 側で渡してる形
  product?: {
    name?: string;
    asin?: string;
    tags?: string[];
  };

  persona?: string;
  pain?: string;

  vars?: TemplateVars;

  /** タイトルが取れなかったときの保険 */
  fallbackTitle?: string;
  /** タグが取れなかったときの保険 */
  fallbackTags?: string[];
};

export type GenerateBlogEngineResult = {
  title: string;
  excerpt: string | null;
  tags: string[];
  content: string;

  // 将来、画像など返したいならここに追加してOK
  raw: string;
  json: unknown | null;
};

export type LlmGenerateFn = (params: {
  prompt: string;
  siteId: string;
  templateName: string;
}) => Promise<string>;

let injectedLlm: LlmGenerateFn | null = null;

/**
 * Functions 側（またはアプリ側）で LLM 実装を注入するための口
 * 例: setLlmGenerator(async ({prompt}) => callOpenAI(prompt))
 */
export function setLlmGenerator(fn: LlmGenerateFn): void {
  injectedLlm = fn;
}

export async function generateBlogEngine(
  params: GenerateBlogEngineParams
): Promise<GenerateBlogEngineResult> {
  const vars: TemplateVars = {
    ...(params.vars ?? {}),
    site: {
      id: params.siteId,
      displayName: params.siteName ?? params.siteId,
      ...(isRecord((params.vars ?? {}).site)
        ? ((params.vars ?? {}).site as Record<string, unknown>)
        : {}),
    },
    product: {
      ...(params.product ?? {}),
      ...(isRecord((params.vars ?? {}).product)
        ? ((params.vars ?? {}).product as Record<string, unknown>)
        : {}),
    },
    persona:
      params.persona ??
      (typeof (params.vars ?? {}).persona === "string"
        ? (params.vars ?? {}).persona
        : ""),
    pain:
      params.pain ??
      (typeof (params.vars ?? {}).pain === "string"
        ? (params.vars ?? {}).pain
        : ""),
  };

  const prompt = await promptFromTemplate(params.templateName, vars);

  // 1) LLMが注入されているなら使う
  // 2) なければテンプレをそのまま「raw」として扱う（開発用）
  const raw = injectedLlm
    ? await injectedLlm({
        prompt,
        siteId: params.siteId,
        templateName: params.templateName,
      })
    : prompt;

  const fallbackTitle =
    params.fallbackTitle ??
    (typeof params.product?.name === "string" && params.product.name.trim()
      ? params.product.name.trim()
      : "記事タイトル");

  const fallbackTags =
    params.fallbackTags ??
    (Array.isArray(params.product?.tags) ? params.product?.tags ?? [] : []);

  const parsed = parseAiBlogOutput({
    raw,
    fallbackTitle,
    fallbackTags,
  });

  return {
    title: parsed.title,
    excerpt: parsed.excerpt,
    tags: parsed.tags,
    content: parsed.content,
    raw,
    json: parsed.json,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

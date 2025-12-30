// firebase/functions/src/lib/content/engine/generateBlogEngine.ts
import { getOpenAI } from "../../infra/openai.js";
import { BASE_TRUST_PROMPT } from "../../prompts/baseTrustPrompt.js";
import {
  buildPromptFromTemplate,
  type BuildPromptInput,
} from "./promptFromTemplate.js";
import {
  parseAiBlogOutput,
  BLOG_JSON_SCHEMA,
  type BlogJsonOut,
} from "./parseAiBlogOutput.js";

const MODEL = process.env.MODEL_BLOG || "gpt-4o-mini";

export type GenerateBlogEngineParams = BuildPromptInput & {
  temperature?: number;
  maxOutputTokens?: number;
};

export type GeneratedBlogResult = {
  title: string;
  excerpt: string | null;
  tags: string[];
  content: string;
  imageUrl?: string | null;
  imageCredit?: string | null;
  imageCreditLink?: string | null;
  /** デバッグ用（必要なら） */
  raw?: string;
  json?: BlogJsonOut | null;
};

function getOutputText(res: unknown): string {
  // openai.responses.create の output_text を優先
  const maybe = res as { output_text?: unknown };
  if (typeof maybe?.output_text === "string") return maybe.output_text;

  // fallback（古いSDK互換）
  try {
    const anyRes = res as {
      output?: Array<{
        content?: Array<{ text?: { value?: string } }>;
      }>;
    };
    const v = anyRes.output?.[0]?.content?.[0]?.text?.value ?? "";
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

export async function generateBlogEngine(
  params: GenerateBlogEngineParams
): Promise<GeneratedBlogResult> {
  const openai = getOpenAI();

  const promptBody = buildPromptFromTemplate(params);
  const fullPrompt = `${BASE_TRUST_PROMPT}\n\n${promptBody}`;

  if (process.env.DEBUG_BLOG === "1") {
    console.log("[ENGINE PROMPT]", fullPrompt.slice(0, 700));
  }

  const temperature =
    typeof params.temperature === "number" ? params.temperature : 0.4;
  const maxOutputTokens =
    typeof params.maxOutputTokens === "number" ? params.maxOutputTokens : 2000;

  const res = await openai.responses.create({
    model: MODEL,
    input: fullPrompt,
    temperature,
    max_output_tokens: maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name: "BlogOutline",
        schema: BLOG_JSON_SCHEMA,
        strict: false, // 既存と同じ（ハイブリッド出力吸収）
      },
    },
  });

  const raw = getOutputText(res);

  if (process.env.DEBUG_BLOG === "1") {
    console.log("[ENGINE RAW]", raw.slice(0, 700));
  }

  const parsed = parseAiBlogOutput({
    raw,
    fallbackTitle: `${params.product?.name ?? "記事"} 値下げ情報`,
    fallbackTags: Array.isArray(params.product?.tags)
      ? params.product.tags
      : [],
  });

  return {
    title: parsed.title,
    excerpt: parsed.excerpt,
    tags: parsed.tags,
    content: parsed.content,
    imageUrl: null,
    imageCredit: null,
    imageCreditLink: null,
    raw: process.env.DEBUG_BLOG === "1" ? raw : undefined,
    json: process.env.DEBUG_BLOG === "1" ? parsed.json : undefined,
  };
}

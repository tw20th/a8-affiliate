//packages/content-engine/src/index.ts
export { loadTemplateText } from "./loadTemplate.js";
export { promptFromTemplate } from "./promptFromTemplate.js";

export type { TemplateVars, GenerateFromTemplateParams } from "./types.js";

export {
  generateBlogEngine,
  setLlmGenerator,
  type GenerateBlogEngineParams,
  type GenerateBlogEngineResult,
  type LlmGenerateFn,
} from "./engine/generateBlogEngine.js";

export { parseAiBlogOutput } from "./engine/parseAiBlogOutput.js";

/**
 * 旧互換：generateContentWithTemplate(templateName, vars) -> Markdown（string）
 * ※ 互換をパッケージ側に残したい場合だけ使う
 */
export async function generateContentWithTemplate(
  templateName: string,
  vars: Record<string, unknown> & { site?: { id?: string } }
): Promise<string> {
  const { generateBlogEngine } = await import("./engine/generateBlogEngine.js");

  const result = await generateBlogEngine({
    siteId: String(vars?.site?.id ?? "unknown"),
    templateName,
    vars,
  });

  return result.content;
}

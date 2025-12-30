// packages/content-engine/src/types.ts
export type TemplateVars = Record<string, unknown>;

export type GenerateFromTemplateParams = {
  /** templates/ 配下のファイル名（例: blogTemplate_discover.txt） */
  templateName: string;
  /** テンプレ置換用の変数 */
  vars: TemplateVars;
};

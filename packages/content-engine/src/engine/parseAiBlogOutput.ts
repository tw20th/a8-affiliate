export type BlogJsonOut = {
  title?: string;
  excerpt?: string;
  slugKeys?: string[];
  toc?: string[];
  sections?: Array<{ h2?: string; bodyMd?: string }>;
  faq?: Array<{ q?: string; a?: string }>;
  cta?: { label?: string; note?: string };
  titleOptions?: Array<{
    title?: string;
    warmScore?: number;
    clarityScore?: number;
    naturalnessScore?: number;
  }>;
};

export const BLOG_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    excerpt: { type: "string" },
    slugKeys: { type: "array", items: { type: "string" } },
    toc: { type: "array", items: { type: "string" } },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          h2: { type: "string" },
          bodyMd: { type: "string" },
        },
        required: ["h2", "bodyMd"],
      },
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          q: { type: "string" },
          a: { type: "string" },
        },
        required: ["q", "a"],
      },
    },
    cta: {
      type: "object",
      additionalProperties: false,
      properties: {
        label: { type: "string" },
        note: { type: "string" },
      },
      required: ["label", "note"],
    },
    titleOptions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          warmScore: { type: "number" },
          clarityScore: { type: "number" },
          naturalnessScore: { type: "number" },
        },
        required: ["title", "warmScore", "clarityScore", "naturalnessScore"],
      },
    },
  },
  required: ["title"],
} as const;

function sanitizeText(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toMarkdown(j: BlogJsonOut): string {
  const lines: string[] = [];
  if (j.title) lines.push(`# ${j.title}`);
  if (j.excerpt) lines.push("", String(j.excerpt));

  if (Array.isArray(j.toc) && j.toc.length) {
    lines.push("", "## 目次", ...j.toc.map((t) => `- ${t}`));
  }

  if (Array.isArray(j.sections)) {
    for (const s of j.sections) {
      if (!s) continue;
      if (s.h2) lines.push("", `## ${s.h2}`);
      if (s.bodyMd) lines.push(String(s.bodyMd));
    }
  }

  if (Array.isArray(j.faq) && j.faq.length) {
    lines.push("", "## よくある質問");
    for (const f of j.faq) {
      if (!f) continue;
      if (f.q) lines.push(`**Q. ${f.q}**`);
      if (f.a) lines.push(String(f.a));
      lines.push("");
    }
  }

  if (j.cta?.label || j.cta?.note) {
    lines.push("", `> CTA: ${j.cta?.label ?? "公式で詳しく見る"}`);
    if (j.cta?.note) lines.push(String(j.cta.note));
  }

  return lines.join("\n");
}

function extractExcerptFromMarkdown(md: string): string | null {
  if (!md.trim()) return null;
  const text = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 4)
    .join(" ");
  const cleaned = text.replace(/[#>*_`]/g, "");
  if (!cleaned.trim()) return null;
  return cleaned.slice(0, 130);
}

/**
 * exactOptionalPropertyTypes=true 対応：
 * optional は「undefined を代入」ではなく「プロパティを出さない」
 */
type HeaderTitleOption = {
  title: string;
  warmScore?: number;
  clarityScore?: number;
  naturalnessScore?: number;
};

type HeaderMeta = {
  title?: string;
  titleOptions?: HeaderTitleOption[];
};

function extractJsonHeaderAndBody(raw: string): {
  meta: HeaderMeta | null;
  bodyMd: string;
} {
  const text = raw.trimStart();
  if (!text.startsWith("```json") && !text.startsWith("```JSON")) {
    return { meta: null, bodyMd: raw.trim() };
  }

  const firstFenceEnd = text.indexOf("\n", 3);
  if (firstFenceEnd === -1) return { meta: null, bodyMd: raw.trim() };

  const afterFirst = text.slice(firstFenceEnd + 1);
  const closingIndex = afterFirst.indexOf("```");
  if (closingIndex === -1) return { meta: null, bodyMd: raw.trim() };

  const jsonBlock = afterFirst.slice(0, closingIndex).trim();
  const body = afterFirst.slice(closingIndex + 3).trim();

  try {
    const parsed = JSON.parse(jsonBlock) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return { meta: null, bodyMd: body };
    }

    const obj = parsed as Record<string, unknown>;

    const title =
      typeof obj.title === "string" && obj.title.trim().length > 0
        ? obj.title.trim()
        : null;

    const titleOptions: HeaderTitleOption[] | null = Array.isArray(
      obj.titleOptions
    )
      ? obj.titleOptions
          .map((o): HeaderTitleOption | null => {
            if (typeof o !== "object" || o === null) return null;
            const rec = o as Record<string, unknown>;
            if (typeof rec.title !== "string" || !rec.title.trim()) return null;

            const out: HeaderTitleOption = { title: rec.title.trim() };

            if (typeof rec.warmScore === "number")
              out.warmScore = rec.warmScore;
            if (typeof rec.clarityScore === "number")
              out.clarityScore = rec.clarityScore;
            if (typeof rec.naturalnessScore === "number")
              out.naturalnessScore = rec.naturalnessScore;

            return out;
          })
          .filter((v): v is HeaderTitleOption => v !== null)
      : null;

    if (!title && (!titleOptions || titleOptions.length === 0)) {
      return { meta: null, bodyMd: body };
    }

    const meta: HeaderMeta = {};
    if (title) meta.title = title;
    if (titleOptions && titleOptions.length) meta.titleOptions = titleOptions;

    return { meta, bodyMd: body };
  } catch {
    return { meta: null, bodyMd: body };
  }
}

function pickBestTitleFromMeta(
  meta: HeaderMeta | null,
  fallback: string
): string {
  const baseTitle = meta?.title?.trim() ?? "";
  const opts = Array.isArray(meta?.titleOptions) ? meta?.titleOptions : [];

  if (opts.length) {
    const scored = opts
      .map((o) => {
        const t = o.title.trim();
        if (!t) return null;
        const warm = typeof o.warmScore === "number" ? o.warmScore : 0;
        const clarity = typeof o.clarityScore === "number" ? o.clarityScore : 0;
        const natural =
          typeof o.naturalnessScore === "number" ? o.naturalnessScore : 0;
        return { title: t, total: warm + clarity + natural };
      })
      .filter((v): v is { title: string; total: number } => v !== null);

    if (scored.length) {
      scored.sort((a, b) =>
        b.total !== a.total
          ? b.total - a.total
          : a.title.length - b.title.length
      );
      return scored[0]!.title;
    }
  }

  return baseTitle || fallback;
}

function hasStructuredSections(j: BlogJsonOut | null): j is BlogJsonOut {
  return !!j && Array.isArray(j.sections) && j.sections.length > 0;
}

function normalizeTitleOptions(
  input: BlogJsonOut["titleOptions"]
): HeaderTitleOption[] | undefined {
  if (!Array.isArray(input)) return undefined;

  const out = input
    .map((o): HeaderTitleOption | null => {
      if (!o || typeof o !== "object") return null;
      const title = typeof o.title === "string" ? o.title.trim() : "";
      if (!title) return null;

      const rec: HeaderTitleOption = { title };

      if (typeof o.warmScore === "number") rec.warmScore = o.warmScore;
      if (typeof o.clarityScore === "number") rec.clarityScore = o.clarityScore;
      if (typeof o.naturalnessScore === "number")
        rec.naturalnessScore = o.naturalnessScore;

      return rec;
    })
    .filter((v): v is HeaderTitleOption => v !== null);

  return out.length ? out : undefined;
}

export function parseAiBlogOutput(params: {
  raw: string;
  fallbackTitle: string;
  fallbackTags: string[];
}): {
  title: string;
  excerpt: string | null;
  tags: string[];
  content: string;
  json: BlogJsonOut | null;
} {
  const rawAll = params.raw ?? "";

  // 1) 完全JSONとして parse できるか
  let jsonParsed: BlogJsonOut | null = null;
  try {
    const obj = JSON.parse(rawAll) as unknown;
    if (typeof obj === "object" && obj !== null)
      jsonParsed = obj as BlogJsonOut;
  } catch {
    jsonParsed = null;
  }

  // 2) JSON→Markdown 化できるならそれを使う
  const mdFromJson = hasStructuredSections(jsonParsed)
    ? toMarkdown(jsonParsed)
    : "";

  // 3) だめなら先頭 ```json ... ``` をメタとして抜く
  const { meta: headerMeta, bodyMd } = extractJsonHeaderAndBody(rawAll);

  const markdownBody = sanitizeText(mdFromJson || bodyMd || rawAll.trim());

  // 4) title
  let title = params.fallbackTitle;

  const jsonTitle =
    typeof jsonParsed?.title === "string" && jsonParsed.title.trim()
      ? jsonParsed.title.trim()
      : null;

  const jsonTitleOptions = normalizeTitleOptions(jsonParsed?.titleOptions);

  if (jsonTitle || jsonTitleOptions) {
    const meta: HeaderMeta = {};
    if (jsonTitle) meta.title = jsonTitle;
    if (jsonTitleOptions) meta.titleOptions = jsonTitleOptions;
    title = pickBestTitleFromMeta(meta, params.fallbackTitle);
  } else if (headerMeta) {
    title = pickBestTitleFromMeta(headerMeta, params.fallbackTitle);
  }

  // 5) excerpt
  const excerptFromJson =
    typeof jsonParsed?.excerpt === "string" ? jsonParsed.excerpt : null;
  const excerpt = excerptFromJson ?? extractExcerptFromMarkdown(markdownBody);

  // 6) tags（slugKeys優先 → fallbackTags）
  let tags: string[] = [];
  if (Array.isArray(jsonParsed?.slugKeys)) {
    tags = jsonParsed.slugKeys
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  } else {
    tags = params.fallbackTags
      .filter((t) => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // 7) content 保険
  let content = markdownBody;
  if (!content.trim()) {
    const safeExcerpt = excerpt ?? "";
    content = `# ${title}\n\n${safeExcerpt}`.trim();
  }

  return { title, excerpt, tags, content, json: jsonParsed };
}

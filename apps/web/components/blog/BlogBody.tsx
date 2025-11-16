// apps/web/components/blog/BlogBody.tsx
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
// ★ 見出しをリンクにするプラグインはやめる
// import rehypeAutolink from "rehype-autolink-headings";
import rehypeExternalLinks from "rehype-external-links";
import { normalizeBlogMarkdown } from "@/utils/markdown";

function AffiliateCta({
  href,
  label = "公式サイトへ",
  className = "",
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className={
        "inline-flex items-center justify-center rounded-lg border px-4 py-2 font-medium hover:shadow-sm " +
        className
      }
    >
      {label}
    </a>
  );
}

// 悩みボタン用（/pain/:id へ飛ばす）
function PainLink({ tag, label }: { tag: string; label: string }) {
  const href = `/pain/${encodeURIComponent(tag)}`;
  return (
    <a
      href={href}
      className="inline-flex items-center rounded-full border px-3 py-1 text-sm hover:shadow-sm mr-2 mb-2"
    >
      {label}
    </a>
  );
}

type Props = { content: string };

const isA8 = (u?: string) => !!u && /(^|\/\/)px\.a8\.net/i.test(u);

export default function BlogBody({ content }: Props) {
  const md = React.useMemo(() => normalizeBlogMarkdown(content), [content]);

  const components = {
    a({ href, children, ...rest }: any) {
      const url = href as string | undefined;
      const isExternal = !!url && /^https?:\/\//i.test(url);
      const isA8Link = isA8(url);

      return (
        <a
          {...rest}
          href={url}
          target={isExternal ? "_blank" : undefined}
          // A8 のときだけ sponsored を付ける
          rel={
            isExternal
              ? `${
                  isA8Link ? "nofollow sponsored" : "nofollow"
                } noopener noreferrer`
              : undefined
          }
          className="underline"
        >
          {children}
        </a>
      );
    },
    img({ src, alt }: any) {
      // A8の画像バナーは非表示
      if (isA8(src)) return null;
      return (
        <img
          src={src}
          alt={alt ?? ""}
          className="rounded-xl mx-auto my-4 max-h-[420px] w-auto"
        />
      );
    },
    ul(props: any) {
      return <ul {...props} className="list-disc pl-6 space-y-1" />;
    },
    ol(props: any) {
      return <ol {...props} className="list-decimal pl-6 space-y-1" />;
    },
    blockquote(props: any) {
      return (
        <blockquote
          {...props}
          className="border-l-4 pl-4 italic text-gray-700"
        />
      );
    },
    h2(props: any) {
      return <h2 {...props} className="mt-10 mb-3 text-2xl font-bold" />;
    },
    h3(props: any) {
      return <h3 {...props} className="mt-8 mb-2 text-xl font-semibold" />;
    },
    code({ inline, children, ...rest }: any) {
      return inline ? (
        <code {...rest} className="px-1 py-0.5 rounded bg-gray-100">
          {children}
        </code>
      ) : (
        <pre className="rounded-xl bg-gray-100 p-4 overflow-auto text-sm">
          <code {...rest}>{children}</code>
        </pre>
      );
    },
    // :::cta[ラベル](URL) / :::pain[テキスト](tag)
    p({ children }: any) {
      const txt = Array.isArray(children)
        ? children.join("")
        : String(children ?? "");
      const line = txt.trim();

      // --- CTA ボタン ---
      const mCta = /^:::cta\[(.+?)\]\((https?:\/\/[^\s)]+)\)$/.exec(line);
      if (mCta) {
        return <AffiliateCta href={mCta[2]} label={mCta[1]} className="my-6" />;
      }
      if (/^:::+\s*cta/i.test(line)) return null; // 残骸は非表示

      // --- 悩みボタン ---
      const mPain = /^:::pain\[(.+?)\]\(([^)]+)\)$/.exec(line);
      if (mPain) {
        return <PainLink tag={mPain[2]} label={mPain[1]} />;
      }
      if (/^:::+\s*pain/i.test(line)) return null;

      return <p className="leading-7 my-3">{children}</p>;
    },
  };

  return (
    <div className="prose prose-neutral max-w-none prose-img:rounded-xl prose-headings:scroll-mt-20">
      <ReactMarkdown
        components={components as any}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          // ★ 見出し自動リンクはオフにして、クリックで飛ばないようにする
          [
            rehypeExternalLinks,
            { target: "_blank", rel: ["nofollow", "noopener", "noreferrer"] },
          ],
        ]}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

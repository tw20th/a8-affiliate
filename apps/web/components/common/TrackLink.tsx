"use client";

import { MouseEvent } from "react";
import { useRouter } from "next/navigation";

type Props = {
  href: string;
  children: React.ReactNode;
  type: "offer" | "blog";
  siteId: string;
  offerId?: string;
  blogSlug?: string;
  where?: string; // クリック位置のメタ情報
  className?: string;
  newTab?: boolean; // デフォルト true for external
};

export default function TrackLink({
  href,
  children,
  type,
  siteId,
  offerId,
  blogSlug,
  where,
  className,
  newTab = true,
}: Props) {
  const router = useRouter();

  const onClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    try {
      // 先にログ送信（失敗しても遷移は継続）
      navigator.sendBeacon?.(
        "/api/track",
        new Blob(
          [
            JSON.stringify({
              type,
              siteId,
              offerId: offerId ?? null,
              blogSlug: blogSlug ?? null,
              href,
              where: where ?? null,
              ts: Date.now(),
            }),
          ],
          { type: "application/json" }
        )
      );
    } catch {}
    // 外部は target=_blank、内部は router.push
    const isExternal = /^https?:\/\//.test(href);
    if (isExternal) return; // allow default (newTab=true default)
    e.preventDefault();
    router.push(href);
  };

  return (
    <a
      href={href}
      onClick={onClick}
      target={newTab && /^https?:\/\//.test(href) ? "_blank" : undefined}
      rel={newTab ? "nofollow sponsored noopener noreferrer" : undefined}
      className={className}
    >
      {children}
    </a>
  );
}

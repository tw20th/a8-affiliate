"use client";
import * as React from "react";

type Props = { slug: string; endpoint?: string };

/**
 * 表示時に1回だけ:
 * POST { slug, type: "view" } を /trackClick へ送信
 */
export default function TrackBlog({ slug, endpoint }: Props) {
  const url = endpoint || process.env.NEXT_PUBLIC_TRACK_URL || "/trackClick"; // Hosting で Functions に rewrite する前提

  // 表示1回だけ送る
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    try {
      const payload = JSON.stringify({ slug, type: "view" as const });
      // ページ遷移でも落ちにくい sendBeacon を優先
      if ("sendBeacon" in navigator) {
        const blob = new Blob([payload], { type: "application/json" });
        (navigator as any).sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      }
    } catch {
      /* no-op */
    }
  }, [slug, url]);

  return null;
}

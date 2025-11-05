"use client";
import * as React from "react";

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  slug: string;
};

export default function CtaLink({ slug, onClick, ...rest }: Props) {
  function send(type: "cta") {
    try {
      const endpoint = process.env.NEXT_PUBLIC_TRACK_URL || "/trackClick";
      const payload = JSON.stringify({ slug, type });
      if ("sendBeacon" in navigator) {
        const blob = new Blob([payload], { type: "application/json" });
        (navigator as any).sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      }
    } catch {}
  }

  return (
    <a
      {...rest}
      onClick={(e) => {
        send("cta");
        onClick?.(e);
      }}
    />
  );
}

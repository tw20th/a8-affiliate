"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { fetchCollection } from "@/lib/firestore-rest";
import Link from "next/link";

type Creative = {
  type: "banner" | "text";
  href: string;
  imgSrc?: string;
  label?: string;
};
type Offer = {
  id: string;
  title: string;
  description?: string;
  images?: string[];
  creatives?: Creative[];
  updatedAt?: number;
};

function sendClick(payload: Record<string, any>) {
  try {
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      navigator.sendBeacon("/api/track", blob);
    } else {
      fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  } catch {}
}

export default function OfferGallery(props: {
  siteId: string;
  variant?: "grid" | "list" | "hero";
  limit?: number;
}) {
  const { siteId, variant = "grid", limit = 24 } = props;
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  // siteId を ref に保持（useCallback の依存から外すため）
  const siteIdRef = useRef(siteId);
  useEffect(() => {
    siteIdRef.current = siteId;
  }, [siteId]);

  useEffect(() => {
    (async () => {
      const where: any[] = [
        ["siteIds", "array-contains", siteId],
        ["archived", "==", false],
      ];
      const orderBy: any = ["updatedAt", "desc"];
      const res = await fetchCollection<Offer>("offers", {
        where,
        orderBy,
        limit,
      });
      setOffers(res);
      setLoading(false);
    })();
  }, [siteId, limit]);

  // ★ ここを「早期 return より前」に移動
  const makeFireClick = useCallback(
    (offerId: string) => (where: string, href: string) =>
      sendClick({
        type: "offer_click",
        siteId: siteIdRef.current,
        offerId,
        href,
        where,
        ts: Date.now(),
      }),
    []
  );

  if (loading) return <div className="p-6">読み込み中…</div>;
  if (!offers.length)
    return <div className="p-6">掲載中の案件がありません。</div>;

  const RenderImg = ({
    src,
    alt,
    width,
    height,
    className,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
    className?: string;
  }) => (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );

  const RenderImage = ({
    src,
    alt,
    width,
    height,
    className,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
    className?: string;
  }) => {
    const isA8 = /(?:^|\.)a8\.net\//.test(src);
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        unoptimized={isA8}
      />
    );
  };

  const Card = ({ o }: { o: Offer }) => {
    const banner = o.creatives?.find((c) => c.type === "banner");
    const text = o.creatives?.find((c) => c.type === "text");
    const hero = banner?.imgSrc ?? o.images?.[0];
    const fireClick = makeFireClick(o.id);
    const ctaHref = banner?.href ?? text?.href;
    const ui = (o as any).ui as
      | { priceLabel?: string; minTermLabel?: string; isPriceDynamic?: boolean }
      | undefined;

    return (
      <article className="card p-4">
        {hero ? (
          <a
            href={ctaHref || `/offers/${o.id}`}
            target={ctaHref ? "_blank" : undefined}
            rel={ctaHref ? "nofollow sponsored" : undefined}
            className="block"
            onClick={() => fireClick("gallery_card_image", ctaHref || "")}
          >
            <RenderImage
              src={hero}
              alt={o.title}
              width={600}
              height={400}
              className="img-soft w-full mb-3 h-auto"
            />
          </a>
        ) : null}

        <h3 className="text-[15px] md:text-base font-semibold text-gray-800 leading-snug mb-1">
          <Link href={`/offers/${o.id}`} className="hover:underline">
            {o.title}
          </Link>
        </h3>

        {o.description && (
          <p className="text-sm text-gray-600 line-clamp-3 mb-3">
            {o.description}
          </p>
        )}
        {/* 目安価格・最低期間 */}
        {(ui?.priceLabel || ui?.minTermLabel) && (
          <div className="mb-3 text-sm text-gray-700">
            {ui?.priceLabel && (
              <div>
                <span className="font-medium">{ui.priceLabel}</span>
                {ui?.isPriceDynamic ? (
                  <span className="ml-1 text-xs text-gray-500">
                    （目安・最新は公式）
                  </span>
                ) : null}
              </div>
            )}
            {ui?.minTermLabel && (
              <div className="text-xs text-gray-600">{ui.minTermLabel}</div>
            )}
          </div>
        )}

        <div>
          {banner?.href && (
            <a
              href={banner.href}
              rel="nofollow sponsored"
              target="_blank"
              className="btn btn-brand"
              onClick={() => fireClick("gallery_card_cta", banner.href)}
            >
              公式で詳しく見る
            </a>
          )}
          {!banner?.href && text?.href && (
            <a
              href={text.href}
              rel="nofollow sponsored"
              target="_blank"
              className="btn btn-ghost"
              onClick={() => fireClick("gallery_card_cta", text.href!)}
            >
              {text.label ?? "公式で詳しく見る"}
            </a>
          )}
        </div>
      </article>
    );
  };

  if (variant === "list") {
    return (
      <section className="container-kariraku space-y-5">
        <header className="mb-2">
          <h1 className="h1">家電レンタル特集</h1>
          <p className="text-xs text-gray-500">※ 本ページは広告を含みます</p>
        </header>
        {offers.map((o) => {
          const banner = o.creatives?.find((c) => c.type === "banner");
          const text = o.creatives?.find((c) => c.type === "text");
          const hero = banner?.imgSrc ?? o.images?.[0];
          const href = banner?.href ?? text?.href;
          return (
            <div key={o.id} className="card p-4 flex gap-4">
              {hero && (
                <div className="w-40 shrink-0">
                  {href ? (
                    <a href={href} rel="nofollow sponsored" target="_blank">
                      <RenderImg
                        src={hero}
                        alt={o.title}
                        width={320}
                        height={200}
                        className="img-soft h-auto"
                      />
                    </a>
                  ) : (
                    <RenderImg
                      src={hero}
                      alt={o.title}
                      width={320}
                      height={200}
                      className="img-soft h-auto"
                    />
                  )}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-semibold mb-1">
                  <Link href={`/offers/${o.id}`} className="hover:underline">
                    {o.title}
                  </Link>
                </h3>
                {o.description && (
                  <p className="mt-1 text-sm text-gray-600">{o.description}</p>
                )}
                <div className="mt-2">
                  {banner?.href ? (
                    <a
                      href={banner.href}
                      rel="nofollow sponsored"
                      target="_blank"
                      className="btn btn-brand"
                    >
                      公式で詳しく見る
                    </a>
                  ) : text?.href ? (
                    <a
                      href={text.href}
                      rel="nofollow sponsored"
                      target="_blank"
                      className="btn btn-ghost"
                    >
                      {text.label ?? "公式で詳しく見る"}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    );
  }

  if (variant === "hero") {
    const [first, ...rest] = offers;
    return (
      <main className="container-kariraku space-y-8">
        <header className="space-y-2">
          <h1 className="h1">家電レンタルおすすめ</h1>
          <p className="text-sm text-gray-600">※ 本ページは広告を含みます</p>
        </header>

        <section className="card p-6 md:p-8">
          <Card o={first} />
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rest.map((o) => (
            <Card key={o.id} o={o} />
          ))}
        </section>
      </main>
    );
  }

  // default: grid
  return (
    <main className="container-kariraku space-y-8">
      <header className="space-y-2">
        <h1 className="h1">家電レンタル特集</h1>
        <p className="text-sm text-gray-600">※ 本ページは広告を含みます</p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {offers.map((o) => (
          <Card key={o.id} o={o} />
        ))}
      </section>
    </main>
  );
}

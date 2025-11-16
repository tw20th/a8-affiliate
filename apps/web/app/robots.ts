import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.kariraku.com"
  ).replace(/\/$/, "");

  return {
    // ▼ 重複を生みやすいパラメータ一覧はnoindex運用に加えてrobotsでも抑制
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // 旧: products 系（保険）
          "/products",
          "/products/",
          "/products/*",
          // ブログ一覧のパラメータページ（canonical /blog と併用）
          "/*?*sort=",
          "/*?*type=",
        ],
      },
    ],
    sitemap: [`${baseUrl}/sitemap.xml`],
  };
}

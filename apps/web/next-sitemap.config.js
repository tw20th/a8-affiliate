/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://www.kariraku.com", // ← あなたの本番URL
  generateRobotsTxt: true, // robots.txt も自動生成
  sitemapSize: 7000, // ページが増えても分割対応
  changefreq: "daily",
  priority: 0.7,

  exclude: ["/admin/*", "/api/*"], // 管理画面・APIなどは除外
  robotsTxtOptions: {
    policies: [{ userAgent: "*", allow: "/" }],
    additionalSitemaps: [
      "https://www.kariraku.com/sitemap.xml", // 追加サイトマップがある場合
    ],
  },

  // ページ別のカスタム設定（任意）
  transform: async (config, path) => {
    // /offersや/blogの優先度を上げる
    if (path.startsWith("/offers") || path.startsWith("/blog")) {
      return {
        loc: path,
        changefreq: "daily",
        priority: 0.9,
        lastmod: new Date().toISOString(),
      };
    }

    // 通常ページは標準設定
    return {
      loc: path,
      changefreq: config.changefreq,
      priority: config.priority,
      lastmod: new Date().toISOString(),
    };
  },
};

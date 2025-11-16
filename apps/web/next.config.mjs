/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "thumbnail.image.rakuten.co.jp" },
      { protocol: "https", hostname: "image.rakuten.co.jp" },
      { protocol: "https", hostname: "shop.r10s.jp" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.a8.net" },
      { protocol: "https", hostname: "img-af.a8.net" },
      { protocol: "https", hostname: "stat.a8.net" },
      { protocol: "https", hostname: "img.afimg.jp" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/products", destination: "/offers", permanent: true },
      { source: "/products/:path*", destination: "/offers", permanent: true },
    ];
  },
};
export default nextConfig;

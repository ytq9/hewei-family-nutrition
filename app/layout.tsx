import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

const sans = Noto_Sans_SC({
  variable: "--font-sans-cn",
  subsets: ["latin"],
  display: "swap",
});

const serif = Noto_Serif_SC({
  variable: "--font-serif-cn",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "禾味日历｜家庭营养菜单",
    template: "%s｜禾味日历",
  },
  description: "手机和电脑都好用的家庭菜单、食材与营养记录工具。",
  applicationName: "禾味日历",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "禾味日历",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "禾味日历｜家庭营养菜单",
    description: "把一日三餐，照顾到每一个人。",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "禾味日历家庭营养菜单" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "禾味日历｜家庭营养菜单",
    description: "把一日三餐，照顾到每一个人。",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f1e8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${sans.variable} ${serif.variable}`}>
        {children}
      </body>
    </html>
  );
}

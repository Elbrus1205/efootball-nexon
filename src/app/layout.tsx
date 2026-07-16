import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Rajdhani } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { SiteFooter } from "@/components/layout/site-footer";
import { AppProviders } from "@/components/providers/app-providers";

const brandDisplay = Rajdhani({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-brand-display",
  display: "swap",
});

const eFootballSans = localFont({
  src: [
    {
      path: "./fonts/eFootballSans-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/eFootballSans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/eFootballSans-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-efootball-sans",
  display: "swap",
});

const eFootballStencil = localFont({
  src: [
    {
      path: "./fonts/eFootballStencil-Regular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-efootball-stencil",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://efootball-nexon.com"),
  title: {
    default: "eFootball Nexon | Турниры по eFootball Mobile",
    template: "%s | eFootball Nexon",
  },
  description:
    "Платформа для турниров по eFootball Mobile с регистрацией, профилями, турнирными сетками, модерацией результатов и realtime-уведомлениями.",
  applicationName: "eFootball Nexon",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "eFootball Nexon",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#080d16",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className={`${eFootballSans.variable} ${eFootballStencil.variable} ${brandDisplay.variable} bg-background font-sans text-foreground antialiased`}>
        <AppProviders>
          <div className="min-h-screen bg-hero">
            <Navbar />
            <main>{children}</main>
            <SiteFooter />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}

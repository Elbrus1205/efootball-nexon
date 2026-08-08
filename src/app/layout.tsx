import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
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
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: "eFootball Nexon",
    title: "eFootball Nexon | Турниры по eFootball Mobile",
    description: "Турниры, рейтинги и профили игроков eFootball Mobile.",
  },
  twitter: {
    card: "summary",
    title: "eFootball Nexon",
    description: "Турнирная платформа eFootball Mobile.",
  },
  applicationName: "eFootball Nexon",
  manifest: "/manifest.webmanifest?v=20260717",
  appleWebApp: {
    capable: true,
    title: "eFootball Nexon",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/efootball-nexon-app-192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/efootball-nexon-app-512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/icons/efootball-nexon-app-192-v2.png"],
    apple: [{ url: "/icons/efootball-nexon-app-192-v2.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
        <Script id="yandex-metrika" strategy="beforeInteractive">
          {`
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=111422814", "ym");

            ym(111422814, "init", {
              ssr: true,
              webvisor: true,
              clickmap: true,
              ecommerce: "dataLayer",
              referrer: document.referrer,
              url: location.href,
              accurateTrackBounce: true,
              trackLinks: true,
            });
          `}
        </Script>
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/111422814"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
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

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { SiteFooter } from "@/components/layout/site-footer";
import { AppProviders } from "@/components/providers/app-providers";

const eFootballSans = localFont({
  src: [
    {
      path: "./fonts/eFootballSans-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/eFootballSans-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/eFootballSans-Bold.ttf",
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
      path: "./fonts/eFootballStencil-Regular.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-efootball-stencil",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://efoottourney.example.com"),
  title: {
    default: "eFootball Nexon | Турниры по eFootball Mobile",
    template: "%s | eFootball Nexon",
  },
  description:
    "Платформа для турниров по eFootball Mobile с регистрацией, профилями, турнирными сетками, модерацией результатов и realtime-уведомлениями.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className={`${eFootballSans.variable} ${eFootballStencil.variable} bg-background font-sans text-foreground antialiased`}>
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

import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { SiteFooter } from "@/components/layout/site-footer";
import { AppProviders } from "@/components/providers/app-providers";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["500", "600", "700"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.variable} ${poppins.variable} bg-background font-sans text-foreground antialiased`}>
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

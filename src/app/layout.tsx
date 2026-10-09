import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { idioma, tema } from "@/lib/i18n";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: { default: "Vecindo", template: "%s · Vecindo" },
  description: "Administración de condominios: cuotas, pagos, residentes y comunicación.",
  applicationName: "Vecindo",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F5F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1513" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [lang, modo] = await Promise.all([idioma(), tema()]);
  return (
    <html lang={lang} data-tema={modo === "sistema" ? undefined : modo} className={jakarta.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}

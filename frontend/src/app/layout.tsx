import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

const satoshi = localFont({
  src: "../fonts/Satoshi-Variable.woff2",
  variable: "--font-satoshi",
  weight: "300 900",
  display: "swap",
});

// Free stand-in for the design's licensed Integral CF; Black (900) matches its glyph widths.
const archivo = Archivo({
  subsets: ["latin"],
  weight: "900",
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "SHOP.CO", template: "%s | SHOP.CO" },
  description: "Find clothes that match your style.",
};

// Every page is rendered per request so the CSP nonce from middleware applies to Next's inline scripts.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${satoshi.variable} ${archivo.variable}`}>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

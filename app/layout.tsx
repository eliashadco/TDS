import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Manrope } from "next/font/google";
import LocalPreviewStabilizer from "@/components/system/LocalPreviewStabilizer";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600", "700"],
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Intelligent Investors - Intelligent Trading System",
  description: "Intelligent trading workflows for investors who want evidence, risk control, and disciplined execution.",
  manifest: "/manifest.json",
  applicationName: "Intelligent Investors",
  icons: {
    icon: "/ii-mark.svg",
    shortcut: "/ii-mark.svg",
  },
  keywords: ["trading", "risk management", "discipline", "marketwatch", "journal"],
  openGraph: {
    title: "Intelligent Investors - Intelligent Trading System",
    description: "Intelligent trading workflows for investors who want evidence, risk control, and disciplined execution.",
    type: "website",
    url: "https://tds.app",
    siteName: "Intelligent Investors",
  },
  twitter: {
    card: "summary",
    title: "Intelligent Investors - Intelligent Trading System",
    description: "Intelligent trading workflows for investors who want evidence, risk control, and disciplined execution.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${manrope.variable} ${ibmPlexMono.variable} bg-tds-bg font-sans text-tds-text antialiased`}
      >
        <LocalPreviewStabilizer />
        {children}
      </body>
    </html>
  );
}

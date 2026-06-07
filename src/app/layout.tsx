import type { Metadata, Viewport } from "next";
import { Anton, Spline_Sans, Spline_Sans_Mono } from "next/font/google";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

// Display / headline face (single weight).
const anton = Anton({
  weight: "400",
  variable: "--font-anton",
  subsets: ["latin"],
  display: "swap",
});

// Body face (variable).
const splineSans = Spline_Sans({
  variable: "--font-spline",
  subsets: ["latin"],
  display: "swap",
});

// Monospace for numbers / scores (tabular figures).
const splineSansMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "2026 World Cup Bracket",
  description:
    "Live leaderboard and bracket for our 2026 World Cup pool — scores update automatically after every match.",
  applicationName: "2026 WC",
  // Installs to the home screen as a standalone app named "2026 WC".
  appleWebApp: { capable: true, title: "2026 WC", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#080b0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${splineSans.variable} ${splineSansMono.variable}`}
    >
      <body className="min-h-dvh">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}

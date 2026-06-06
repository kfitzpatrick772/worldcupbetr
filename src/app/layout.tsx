import type { Metadata } from "next";
import { Anton, Spline_Sans, Spline_Sans_Mono } from "next/font/google";
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
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

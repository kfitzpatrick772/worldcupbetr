import type { MetadataRoute } from "next";

// Web App Manifest — lets the board install to a phone's home screen as a
// standalone app (full-screen, no browser chrome) with the WC '26 icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "2026 World Cup Bracket",
    short_name: "2026 WC",
    description: "Live leaderboard and bracket for our 2026 World Cup pool.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#080b0a",
    theme_color: "#080b0a",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

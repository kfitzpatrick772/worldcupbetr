import { ImageResponse } from "next/og";

// Home-screen icon for iOS ("Add to Home Screen"). iOS rounds the corners and
// needs an opaque background, so we fill black and keep the mark centered.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#080b0a",
        }}
      >
        <div style={{ display: "flex", fontSize: 88, fontWeight: 800, color: "#b9f73e", letterSpacing: -3 }}>
          WC
        </div>
        <div style={{ display: "flex", fontSize: 52, fontWeight: 800, color: "#f6f9f7", marginTop: -2, letterSpacing: 1 }}>
          2026
        </div>
      </div>
    ),
    { ...size },
  );
}

import { ImageResponse } from "next/og";

// App icon, generated at the edge from code (no binary image tooling needed).
// Black background, "WC" in neon green + "2026" in white — the pool's identity.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
        <div style={{ display: "flex", fontSize: 250, fontWeight: 800, color: "#b9f73e", letterSpacing: -8 }}>
          WC
        </div>
        <div style={{ display: "flex", fontSize: 150, fontWeight: 800, color: "#f6f9f7", marginTop: -6, letterSpacing: 2 }}>
          2026
        </div>
      </div>
    ),
    { ...size },
  );
}

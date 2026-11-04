import { ImageResponse } from "next/og";

export const alt = "Task Dispatcher — field service dispatch software";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0d5f4c 0%, #0a3d32 100%)",
          color: "#f6f5f0",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 40 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#f6f5f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0d5f4c",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            TD
          </div>
          <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5 }}>Task Dispatcher</span>
        </div>
        <h1 style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, margin: 0, maxWidth: 900 }}>
          Dispatch field tasks. Track your team live.
        </h1>
        <p style={{ fontSize: 30, marginTop: 28, opacity: 0.85, maxWidth: 900 }}>
          GPS tracking, photo proof of work, and offline sync — in one mobile-first app.
        </p>
      </div>
    ),
    { ...size },
  );
}
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h1 style={{ fontSize: 20 }}>Task Dispatcher could not load</h1>
        <p style={{ color: "#5b6b64" }}>Please reload the page.</p>
        {error.digest ? <p style={{ fontSize: 12 }}>Reference: {error.digest}</p> : null}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 16,
            minHeight: 44,
            padding: "0 16px",
            borderRadius: 8,
            background: "#0d5f4c",
            color: "#fff",
            border: 0,
            fontWeight: 600,
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}

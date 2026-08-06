"use client";

export default function GlobalError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", background: "#faf6f0", color: "#2a241c" }}>
        <div style={{ maxWidth: 480, margin: "15vh auto", padding: "0 1rem", textAlign: "center" }}>
          <p style={{ fontSize: 56, fontWeight: 700, margin: 0, color: "#b04e14" }}>500</p>
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p style={{ color: "#6e6558" }}>
            An unexpected error occurred. Check the server logs — this page
            never exposes stack traces.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "0.6rem 1.25rem",
              borderRadius: 8,
              border: 0,
              background: "#b04e14",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

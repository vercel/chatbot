import React from "react";
import ReactDOM from "react-dom/client";
import { clearAllAuthTokens } from "@/lib/auth/chrome-identity";
import { clearConfigState } from "@/lib/storage/config-storage";
import { extensionDb } from "@/lib/db/database";

function OptionsApp() {
  const [status, setStatus] = React.useState<string>("");

  const resetLocalState = async () => {
    setStatus("Clearing...");
    await Promise.all([
      clearAllAuthTokens(),
      clearConfigState(),
      extensionDb.delete(),
    ]);
    setStatus("Cleared Chrome auth cache and local data.");
  };

  return (
    <main
      style={{
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        padding: 16,
        maxWidth: 720,
      }}
    >
      <h1 style={{ marginTop: 0 }}>Helios Settings</h1>
      <p style={{ color: "#475569" }}>
        This panel is intentionally lightweight. OAuth configuration is controlled
        through environment variables and manifest generation in WXT.
      </p>
      <button
        type="button"
        onClick={() => {
          void resetLocalState();
        }}
        style={{
          border: "1px solid #475569",
          background: "#0f172a",
          color: "#f8fafc",
          borderRadius: 8,
          padding: "8px 12px",
          cursor: "pointer",
        }}
      >
        Clear local extension state
      </button>
      {status ? <p style={{ marginTop: 10 }}>{status}</p> : null}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);

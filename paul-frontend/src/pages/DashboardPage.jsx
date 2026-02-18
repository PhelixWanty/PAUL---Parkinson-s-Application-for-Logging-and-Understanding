import React, { useEffect, useState } from "react";
import { apiFetch } from "../api.js";

export default function DashboardPage() {
  const [meds, setMeds] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "" });

  useEffect(() => {
    let alive = true;

    async function load() {
      setStatus({ loading: true, error: "" });
      try {
        const data = await apiFetch("/api/dashboard/medications");
        if (!alive) return;
        setMeds(data || []);
        setStatus({ loading: false, error: "" });
      } catch (err) {
        if (!alive) return;
        setStatus({ loading: false, error: err.message || "Failed to load meds" });
      }
    }

    load();
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <h3>Dashboard</h3>
      <p>Medication reminders (placeholder for Sprint 1)</p>

      {status.loading && <div>Loading...</div>}
      {status.error && <div style={{ color: "crimson" }}>{status.error}</div>}

      {!status.loading && !status.error && (
        <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
          {meds.map((m, idx) => (
            <div key={idx} style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
              <div><b>{m.name}</b></div>
              <div>Time: {m.time}</div>
              <div>Status: {m.taken ? "Taken" : "Not taken"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

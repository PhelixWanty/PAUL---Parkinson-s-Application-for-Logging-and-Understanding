import React, { useState } from "react";
import { apiFetch } from "../api.js";
import { useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "PATIENT",
  });

  const [status, setStatus] = useState({ loading: false, error: "", ok: "" });

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setStatus({ loading: true, error: "", ok: "" });

    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });

      setStatus({ loading: false, error: "", ok: "Registered! Now login." });
      navigate("/login");
    } catch (err) {
      setStatus({ loading: false, error: err.message || "Registration failed", ok: "" });
    }
  }

  return (
    <div>
      <h3>Create Account</h3>

      <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
        <input
          placeholder="Full name"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          required
        />

        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          required
        />

        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          required
        />

        <select value={form.role} onChange={(e) => update("role", e.target.value)}>
          <option value="PATIENT">PATIENT</option>
          <option value="CAREGIVER">CAREGIVER</option>
          <option value="CLINICIAN">CLINICIAN</option>
        </select>

        <button disabled={status.loading}>
          {status.loading ? "Registering..." : "Register"}
        </button>

        {status.error && <div style={{ color: "crimson" }}>{status.error}</div>}
        {status.ok && <div style={{ color: "green" }}>{status.ok}</div>}
      </form>
    </div>
  );
}

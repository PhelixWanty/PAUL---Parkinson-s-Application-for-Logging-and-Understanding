import React, { useState } from "react";
import { apiFetch } from "../api.js";
import { saveAuth } from "../auth.js";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState({ loading: false, error: "" });

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setStatus({ loading: true, error: "" });

    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(form),
      });

      // expecting: { token, role, email }
      saveAuth({ token: data.token, role: data.role, email: data.email });

      navigate("/");
    } catch (err) {
      setStatus({ loading: false, error: err.message || "Login failed" });
      return;
    }

    setStatus({ loading: false, error: "" });
  }

  return (
    <div>
      <h3>Login</h3>

      <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
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

        <button disabled={status.loading}>
          {status.loading ? "Logging in..." : "Login"}
        </button>

        {status.error && <div style={{ color: "crimson" }}>{status.error}</div>}
      </form>
    </div>
  );
}

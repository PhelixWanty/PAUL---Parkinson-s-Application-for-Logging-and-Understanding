import React from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import RegisterPage from "./pages/RegisterPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import { clearAuth, getAuth, isLoggedIn } from "./auth.js";

function ProtectedRoute({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const navigate = useNavigate();
  const auth = getAuth();

  function logout() {
    clearAuth();
    navigate("/login");
  }

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ marginRight: "auto" }}>PAUL</h2>

        <Link to="/">Dashboard</Link>
        <Link to="/register">Register</Link>
        <Link to="/login">Login</Link>

        {isLoggedIn() && (
          <button onClick={logout} style={{ marginLeft: 12 }}>
            Logout
          </button>
        )}
      </header>

      {isLoggedIn() && (
        <div style={{ marginBottom: 16, fontSize: 14, opacity: 0.9 }}>
          Logged in as <b>{auth.email}</b> ({auth.role})
        </div>
      )}

      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

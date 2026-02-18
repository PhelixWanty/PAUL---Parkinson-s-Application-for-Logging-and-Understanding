export function saveAuth({ token, email, role }) {
  localStorage.setItem("token", token);
  localStorage.setItem("email", email);
  localStorage.setItem("role", role);
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("email");
  localStorage.removeItem("role");
}

export function getAuth() {
  return {
    token: localStorage.getItem("token"),
    email: localStorage.getItem("email"),
    role: localStorage.getItem("role"),
  };
}

export function isLoggedIn() {
  return !!localStorage.getItem("token");
}

import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = "http://localhost:8080";
// If using real phone: http://YOUR_PC_IP:8080

export async function apiFetch(path: string, options: any = {}) {
  const token = await AsyncStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }

  return data;
}
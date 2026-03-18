import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080";

export async function apiFetch(path: string, options: any = {}) {
  const token = await AsyncStorage.getItem("token");

  const headers: any = {
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

  let data = null;

  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }

  return data;
}

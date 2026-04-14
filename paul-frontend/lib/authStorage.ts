import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  token: "token",
  email: "email",
  role: "role",
} as const;

export type AuthData = {
  token: string;
  email: string;
  role: string;
};

export async function saveAuth(data: AuthData) {
  await AsyncStorage.multiSet([
    [KEYS.token, data.token],
    [KEYS.email, data.email],
    [KEYS.role, data.role],
  ]);
}

export async function clearAuth() {
  await AsyncStorage.multiRemove([KEYS.token, KEYS.email, KEYS.role]);
}

export async function getAuth(): Promise<Partial<AuthData>> {
  const [[, token], [, email], [, role]] = await AsyncStorage.multiGet([
    KEYS.token,
    KEYS.email,
    KEYS.role,
  ]);
  return { token: token ?? "", email: email ?? "", role: role ?? "" };
}

export async function getToken(): Promise<string> {
  const token = await AsyncStorage.getItem(KEYS.token);
  return token ?? "";
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await AsyncStorage.getItem(KEYS.token);
  return !!token;
}
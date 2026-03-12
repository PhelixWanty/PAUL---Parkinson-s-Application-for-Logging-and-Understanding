import { View, Text, TextInput, Pressable } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function login() {
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      await AsyncStorage.setItem("token", data.token);
      await AsyncStorage.setItem("email", data.email);
      await AsyncStorage.setItem("role", data.role);

      router.replace("/dashboard");
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <View style={{ padding: 20, gap: 15 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Login</Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
      />

      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}

      <Pressable
        onPress={login}
        style={{
          backgroundColor: "black",
          padding: 15,
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>Login</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/register")}>
        <Text style={{ textAlign: "center" }}>Create Account</Text>
      </Pressable>
    </View>
  );
}
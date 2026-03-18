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
            setError("");

            if (!email.trim() || !password.trim()) {
                setError("Please enter your email and password.");
                return;
            }

            const data = await apiFetch("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    email: email.trim(),
                    password,
                }),
            });

            await AsyncStorage.setItem("token", data.token);
            await AsyncStorage.setItem("email", data.email);
            await AsyncStorage.setItem("role", data.role);

            router.replace("/dashboard");
        } catch (e: any) {
            setError(e.message || "Login failed.");
        }
    }

    return (
        <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 15 }}>

            {/* Welcome text */}
            <Text
                style={{
                    fontSize: 34,
                    fontWeight: "800",
                    textAlign: "center",
                    marginBottom: 10,
                }}
            >
                Welcome to PAUL
            </Text>

            {/* Login title */}
            <Text
                style={{
                    fontSize: 28,
                    fontWeight: "700",
                    textAlign: "center",
                    marginBottom: 10,
                }}
            >
                Login
            </Text>

            <TextInput
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    padding: 12,
                    borderRadius: 8,
                }}
            />

            <TextInput
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    padding: 12,
                    borderRadius: 8,
                }}
            />

            {error ? (
                <Text style={{ color: "red", textAlign: "center" }}>{error}</Text>
            ) : null}

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
                <Text style={{ textAlign: "center", color: "blue" }}>
                    Create Account
                </Text>
            </Pressable>
        </View>
    );
}

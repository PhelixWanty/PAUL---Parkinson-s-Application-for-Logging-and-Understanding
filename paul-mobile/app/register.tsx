import { View, Text, TextInput, Pressable } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { apiFetch } from "../lib/api";

export default function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const role = "PATIENT";

    async function register() {
        try {
            setError("");
            setSuccess("");

            if (!name.trim() || !email.trim() || !password || !confirmPassword) {
                setError("Please fill in all fields.");
                return;
            }

            if (password !== confirmPassword) {
                setError("Passwords do not match.");
                return;
            }

            const data = await apiFetch("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim(),
                    password,
                    role,
                }),
            });

            setSuccess(data?.message || "Account created successfully.");

            setTimeout(() => {
                router.replace("/");
            }, 1200);
        } catch (e: any) {
            setError(e.message || "Registration failed.");
        }
    }

    return (
        <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 15 }}>
            <Text style={{ fontSize: 28, fontWeight: "700", textAlign: "center" }}>
                Create Account
            </Text>

            <TextInput
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    padding: 12,
                    borderRadius: 8,
                }}
            />

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

            <TextInput
                placeholder="Confirm Password"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    padding: 12,
                    borderRadius: 8,
                }}
            />

            <View style={{ gap: 6 }}>
                <Text style={{ fontWeight: "600" }}>Role</Text>
                <View
                    style={{
                        borderWidth: 1,
                        borderColor: "#ccc",
                        padding: 12,
                        borderRadius: 8,
                        backgroundColor: "#f3f3f3",
                    }}
                >
                    <Text>Patient</Text>
                </View>
            </View>

            {error ? (
                <Text style={{ color: "red", textAlign: "center" }}>{error}</Text>
            ) : null}

            {success ? (
                <Text style={{ color: "green", textAlign: "center" }}>{success}</Text>
            ) : null}

            <Pressable
                onPress={register}
                style={{
                    backgroundColor: "black",
                    padding: 15,
                    borderRadius: 10,
                    alignItems: "center",
                }}
            >
                <Text style={{ color: "white", fontWeight: "700" }}>Register</Text>
            </Pressable>

            <Pressable onPress={() => router.replace("/")}>
                <Text style={{ textAlign: "center", color: "blue" }}>
                    Back to Login
                </Text>
            </Pressable>
        </View>
    );
}

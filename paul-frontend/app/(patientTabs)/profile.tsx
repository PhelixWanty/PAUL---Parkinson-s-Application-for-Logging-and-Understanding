import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Alert,
    ScrollView,
    TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../../lib/api";

type UserProfile = {
    id: string;
    name: string;
    email: string;
    userCode: string;
    role?: string | null;
};

export default function ProfileScreen() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(false);

    const [editName, setEditName] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        try {
            setLoading(true);
            const data: UserProfile = await apiFetch("/api/users/me");
            setProfile(data ?? null);
            setEditName(data?.name ?? "");
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed to load profile.");
        } finally {
            setLoading(false);
        }
    }

    async function copyUserCode() {
        if (!profile?.userCode) return;
        await Clipboard.setStringAsync(profile.userCode);
        Alert.alert("Copied", "User code copied to clipboard.");
    }

    async function saveProfileName() {
        if (!editName.trim()) {
            Alert.alert("Missing name", "Please enter your name.");
            return;
        }

        try {
            setProfileSaving(true);

            const updated: UserProfile = await apiFetch("/api/users/me", {
                method: "PUT",
                body: JSON.stringify({
                    name: editName.trim(),
                }),
            });

            setProfile(updated ?? null);
            setEditName(updated?.name ?? editName.trim());
            Alert.alert("Saved", "Your name was updated.");
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed to update profile.");
        } finally {
            setProfileSaving(false);
        }
    }

    async function savePassword() {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert("Missing fields", "Please fill in all password fields.");
            return;
        }

        try {
            setPasswordSaving(true);

            await apiFetch("/api/users/me/password", {
                method: "PUT",
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    confirmPassword,
                }),
            });

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");

            Alert.alert("Saved", "Your password was updated.");
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed to update password.");
        } finally {
            setPasswordSaving(false);
        }
    }

    async function logout() {
        Alert.alert("Log out", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log Out",
                style: "destructive",
                onPress: async () => {
                    try {
                        await AsyncStorage.multiRemove(["token", "email", "role"]);
                        router.replace("/");
                    } catch {
                        Alert.alert("Error", "Failed to log out.");
                    }
                },
            },
        ]);
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Profile</Text>
                <Text style={styles.subtitle}>
                    Manage your account details, password, and sign out.
                </Text>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Account</Text>

                    {loading ? (
                        <Text style={styles.helperText}>Loading profile...</Text>
                    ) : !profile ? (
                        <Text style={styles.helperText}>Profile not loaded.</Text>
                    ) : (
                        <>
                            <View style={styles.profileHeader}>
                                <View style={styles.avatar}>
                                    <Ionicons name="person" size={26} color="#1f2a44" />
                                </View>

                                <View style={{ flex: 1 }}>
                                    <Text style={styles.name}>{profile.name}</Text>
                                    <Text style={styles.email}>{profile.email}</Text>
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Your code</Text>
                            <View style={styles.codeRow}>
                                <Text style={styles.userCodeText}>{profile.userCode}</Text>
                                <Pressable style={styles.copyButton} onPress={copyUserCode}>
                                    <Text style={styles.copyButtonText}>Copy</Text>
                                </Pressable>
                            </View>
                        </>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Update Name</Text>

                    <Text style={styles.inputLabel}>Name</Text>
                    <TextInput
                        value={editName}
                        onChangeText={setEditName}
                        style={styles.input}
                        placeholder="Enter your name"
                        placeholderTextColor="#6B7280"
                    />

                    <Pressable
                        style={[styles.primaryButton, profileSaving && styles.disabled]}
                        onPress={saveProfileName}
                        disabled={profileSaving}
                    >
                        <Text style={styles.primaryButtonText}>
                            {profileSaving ? "Saving..." : "Save Name"}
                        </Text>
                    </Pressable>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Change Password</Text>

                    <Text style={styles.inputLabel}>Current Password</Text>
                    <TextInput
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        style={styles.input}
                        placeholder="Current password"
                        placeholderTextColor="#6B7280"
                        secureTextEntry
                    />

                    <Text style={styles.inputLabel}>New Password</Text>
                    <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        style={styles.input}
                        placeholder="New password"
                        placeholderTextColor="#6B7280"
                        secureTextEntry
                    />

                    <Text style={styles.inputLabel}>Confirm New Password</Text>
                    <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        style={styles.input}
                        placeholder="Confirm new password"
                        placeholderTextColor="#6B7280"
                        secureTextEntry
                    />

                    <Pressable
                        style={[styles.primaryButton, passwordSaving && styles.disabled]}
                        onPress={savePassword}
                        disabled={passwordSaving}
                    >
                        <Text style={styles.primaryButtonText}>
                            {passwordSaving ? "Saving..." : "Update Password"}
                        </Text>
                    </Pressable>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Session</Text>

                    <Pressable style={styles.logoutButton} onPress={logout}>
                        <Ionicons name="log-out-outline" size={18} color="#fff" />
                        <Text style={styles.logoutButtonText}>Log Out</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: "#f7f8fb",
    },
    container: {
        padding: 20,
        gap: 16,
        paddingBottom: 36,
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#1f2a44",
    },
    subtitle: {
        fontSize: 15,
        color: "#5f6b85",
    },
    card: {
        backgroundColor: "white",
        borderRadius: 18,
        padding: 18,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#1f2a44",
        marginBottom: 12,
    },
    helperText: {
        fontSize: 14,
        color: "#5f6b85",
    },
    profileHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 14,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: "#eef2ff",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    name: {
        fontSize: 18,
        fontWeight: "700",
        color: "#1f2a44",
    },
    email: {
        marginTop: 4,
        fontSize: 14,
        color: "#5f6b85",
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: "700",
        color: "#1f2a44",
        marginBottom: 8,
        marginTop: 4,
    },
    input: {
        backgroundColor: "#f7f8fb",
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 14,
        fontSize: 15,
        color: "#111827",
        borderWidth: 1,
        borderColor: "#d8dee9",
        marginBottom: 12,
    },
    codeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    userCodeText: {
        flex: 1,
        backgroundColor: "#f7f8fb",
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 14,
        fontSize: 15,
        fontWeight: "800",
        color: "#1f2a44",
        borderWidth: 1,
        borderColor: "#d8dee9",
    },
    copyButton: {
        backgroundColor: "#1f2a44",
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    copyButtonText: {
        color: "white",
        fontWeight: "800",
    },
    primaryButton: {
        marginTop: 4,
        backgroundColor: "#1f2a44",
        paddingVertical: 16,
        borderRadius: 18,
        alignItems: "center",
    },
    primaryButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "800",
    },
    logoutButton: {
        backgroundColor: "#dc2626",
        borderRadius: 18,
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
    },
    logoutButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "800",
    },
    disabled: {
        opacity: 0.7,
    },
});
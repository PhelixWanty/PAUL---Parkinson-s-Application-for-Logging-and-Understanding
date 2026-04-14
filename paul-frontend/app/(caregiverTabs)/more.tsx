import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    RefreshControl,
    Alert,
    Pressable,
    TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { apiFetch } from "../../lib/api";

type CaregiverProfile = {
    id: string;
    name: string;
    email?: string;
    userCode?: string;
    role?: string | null;
};

export default function CaregiverMoreScreen() {
    const [caregiver, setCaregiver] = useState<CaregiverProfile | null>(null);
    const [refreshing, setRefreshing] = useState(false);

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
            const caregiverData = await apiFetch("/api/users/me");
            setCaregiver(caregiverData ?? null);
            setEditName(caregiverData?.name ?? "");
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to load profile.");
            setCaregiver(null);
        }
    }

    async function onRefresh() {
        try {
            setRefreshing(true);
            await loadProfile();
        } finally {
            setRefreshing(false);
        }
    }

    async function copyUserCode() {
        if (!caregiver?.userCode) return;

        await Clipboard.setStringAsync(caregiver.userCode);
        Alert.alert("Copied", "Your caregiver code was copied.");
    }

    async function saveName() {
        if (!editName.trim()) {
            Alert.alert("Missing name", "Please enter your name.");
            return;
        }

        try {
            setProfileSaving(true);

            const updated = await apiFetch("/api/users/me", {
                method: "PUT",
                body: JSON.stringify({ name: editName.trim() }),
            });

            setCaregiver(updated ?? null);
            setEditName(updated?.name ?? editName.trim());

            Alert.alert("Saved", "Your name was updated.");
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to update name.");
        } finally {
            setProfileSaving(false);
        }
    }

    async function savePassword() {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert("Missing fields", "Please fill in all password fields.");
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert("Passwords do not match", "Please make sure both new passwords match.");
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
            Alert.alert("Error", e.message || "Failed to update password.");
        } finally {
            setPasswordSaving(false);
        }
    }

    async function logout() {
        Alert.alert("Log out", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log out",
                style: "destructive",
                onPress: async () => {
                    await AsyncStorage.multiRemove(["token", "email", "role"]);
                    router.replace("/");
                },
            },
        ]);
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <Text style={styles.title}>More</Text>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Profile</Text>

                    {!caregiver ? (
                        <Text style={styles.emptyText}>Unable to load your profile.</Text>
                    ) : (
                        <>
                            <Text style={styles.nameText}>{caregiver.name}</Text>
                            {!!caregiver.email && (
                                <Text style={styles.helperText}>{caregiver.email}</Text>
                            )}
                            {!!caregiver.role && (
                                <Text style={styles.helperText}>Role: {caregiver.role}</Text>
                            )}
                        </>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Your Caregiver Code</Text>

                    {!!caregiver?.userCode ? (
                        <>
                            <Text style={styles.codeText}>{caregiver.userCode}</Text>
                            <Pressable style={styles.secondaryButton} onPress={copyUserCode}>
                                <Text style={styles.secondaryButtonText}>Copy Code</Text>
                            </Pressable>
                        </>
                    ) : (
                        <Text style={styles.emptyText}>No caregiver code available.</Text>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Change Name</Text>

                    <Text style={styles.inputLabel}>Name</Text>
                    <TextInput
                        value={editName}
                        onChangeText={setEditName}
                        style={styles.input}
                        placeholder="Enter your name"
                        placeholderTextColor="#6B7280"
                    />

                    <Pressable
                        style={[styles.primaryButton, profileSaving && styles.disabledButton]}
                        onPress={saveName}
                        disabled={profileSaving}
                    >
                        <Text style={styles.primaryButtonText}>
                            {profileSaving ? "Saving..." : "Save Name"}
                        </Text>
                    </Pressable>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Change Password</Text>

                    <Text style={styles.inputLabel}>Current password</Text>
                    <TextInput
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        style={styles.input}
                        placeholder="Current password"
                        placeholderTextColor="#6B7280"
                        secureTextEntry
                    />

                    <Text style={styles.inputLabel}>New password</Text>
                    <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        style={styles.input}
                        placeholder="New password"
                        placeholderTextColor="#6B7280"
                        secureTextEntry
                    />

                    <Text style={styles.inputLabel}>Confirm new password</Text>
                    <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        style={styles.input}
                        placeholder="Confirm new password"
                        placeholderTextColor="#6B7280"
                        secureTextEntry
                    />

                    <Pressable
                        style={[styles.primaryButton, passwordSaving && styles.disabledButton]}
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
                        <Text style={styles.logoutButtonText}>Log Out</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#B0B7BC" },
    container: { padding: 16, gap: 16, paddingBottom: 32 },
    title: { fontSize: 28, fontWeight: "800", color: "#1F2937" },

    card: {
        backgroundColor: "#F8FAFC",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#D7DEE3",
        gap: 12,
    },

    sectionTitle: { fontSize: 18, fontWeight: "800", color: "#1F2937" },
    nameText: { fontSize: 20, fontWeight: "700", color: "#1F2937" },
    helperText: { color: "#64748B", fontSize: 14 },
    emptyText: { color: "#64748B", fontSize: 14 },

    codeText: {
        fontSize: 22,
        fontWeight: "800",
        color: "#2563EB",
        letterSpacing: 1,
    },

    inputLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "#475569",
        marginBottom: -4,
    },

    input: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        color: "#111827",
    },

    primaryButton: {
        backgroundColor: "#2563EB",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
    },

    primaryButtonText: {
        color: "#FFFFFF",
        fontWeight: "800",
        fontSize: 15,
    },

    secondaryButton: {
        backgroundColor: "#E2E8F0",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
    },

    secondaryButtonText: {
        color: "#1F2937",
        fontWeight: "800",
        fontSize: 15,
    },

    logoutButton: {
        backgroundColor: "#DC2626",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
    },

    logoutButtonText: {
        color: "#FFFFFF",
        fontWeight: "800",
        fontSize: 15,
    },

    disabledButton: {
        opacity: 0.7,
    },
});
import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    RefreshControl,
    Alert,
    Pressable,
    ActivityIndicator,
    TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { apiFetch } from "../../lib/api";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";

type ClinicianProfile = {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
    userCode?: string;
};

type ConnectionType = "CAREGIVER" | "CLINICIAN";
type ConnectionStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";

type PatientConnection = {
    id: string;
    patientId: string;
    patientName?: string;
    patientEmail?: string;
    patientCode?: string;

    connectedUserId: string;
    connectedUserName?: string;
    connectedUserEmail?: string;
    connectedUserCode?: string;

    connectionType: ConnectionType;
    status: ConnectionStatus;

    patientAccepted: boolean;
    connectedUserAccepted: boolean;
    fullyAccepted: boolean;

    requestedByUserId?: string;
    requestedAt?: string;
    patientAcceptedAt?: string;
    connectedUserAcceptedAt?: string;
    finalizedAt?: string;
};

type ActivePatient = {
    patientId: string;
    patientName?: string;
    email?: string;
    userCode?: string;
};

export default function ClinicianMoreScreen() {
    const [profile, setProfile] = useState<ClinicianProfile | null>(null);
    const [connections, setConnections] = useState<PatientConnection[]>([]);
    const [activePatients, setActivePatients] = useState<ActivePatient[]>([]);

    const [refreshing, setRefreshing] = useState(false);
    const [screenLoading, setScreenLoading] = useState(true);
    const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);

    const [patientSearch, setPatientSearch] = useState("");

    useEffect(() => {
        loadAll();
    }, []);

    function normalizeProfile(data: any): ClinicianProfile | null {
        if (!data || typeof data !== "object") return null;

        return {
            id: data.id ?? data.userId ?? "",
            name: data.name ?? data.fullName ?? "",
            email: data.email ?? "",
            role: data.role ?? "",
            userCode: data.userCode ?? data.code ?? "",
        };
    }

    function normalizeConnections(data: any): PatientConnection[] {
        if (!Array.isArray(data)) return [];
        return data.filter((item) => item && typeof item === "object");
    }

    function normalizePatients(data: any): ActivePatient[] {
        if (!Array.isArray(data)) return [];
        return data
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
                patientId: item.patientId ?? "",
                patientName: item.patientName ?? "",
                email: item.email ?? "",
                userCode: item.userCode ?? "",
            }));
    }

    async function loadAll() {
        try {
            setScreenLoading(true);

            const [profileData, connectionData, activePatientData] = await Promise.all([
                apiFetch("/api/users/me"),
                apiFetch("/api/connections/me"),
                apiFetch("/api/clinician/patients"),
            ]);

            const safeProfile = normalizeProfile(profileData);
            const safeConnections = normalizeConnections(connectionData);
            const safePatients = normalizePatients(activePatientData);

            setProfile(safeProfile);
            setEditName(safeProfile?.name ?? "");
            setEditEmail(safeProfile?.email ?? "");
            setConnections(safeConnections);
            setActivePatients(safePatients);
        } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed to load clinician information.");
        } finally {
            setScreenLoading(false);
        }
    }

    async function onRefresh() {
        try {
            setRefreshing(true);
            await loadAll();
        } finally {
            setRefreshing(false);
        }
    }

    const pendingConnections = useMemo(() => {
        return connections.filter((connection) => {
            return (
                connection.connectionType === "CLINICIAN" &&
                connection.status === "PENDING" &&
                connection.patientAccepted === true &&
                connection.connectedUserAccepted === false
            );
        });
    }, [connections]);

    const filteredActivePatients = useMemo(() => {
        const query = patientSearch.trim().toLowerCase();

        if (!query) return activePatients;

        return activePatients.filter((patient) => {
            const name = (patient.patientName ?? "").toLowerCase();
            const email = (patient.email ?? "").toLowerCase();
            const code = (patient.userCode ?? "").toLowerCase();

            return (
                name.includes(query) ||
                email.includes(query) ||
                code.includes(query)
            );
        });
    }, [activePatients, patientSearch]);

    async function respondToConnection(connectionId: string, accept: boolean) {
        try {
            setLoadingActionId(connectionId);

            await apiFetch(`/api/connections/${connectionId}/respond`, {
                method: "POST",
                body: JSON.stringify({ accept }),
            });

            Alert.alert(
                accept ? "Connection accepted" : "Connection denied",
                accept
                    ? "The patient connection has been accepted."
                    : "The patient connection has been denied."
            );

            await loadAll();
        } catch (e: any) {
            Alert.alert(
                "Error",
                e?.message ||
                    (accept ? "Could not accept connection." : "Could not deny connection.")
            );
        } finally {
            setLoadingActionId(null);
        }
    }

    function confirmAccept(connection: PatientConnection) {
        Alert.alert(
            "Accept connection",
            `Approve connection request${
                connection.patientName ? ` from ${connection.patientName}` : ""
            }?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Accept",
                    onPress: () => respondToConnection(connection.id, true),
                },
            ]
        );
    }

    function confirmDeny(connection: PatientConnection) {
        Alert.alert(
            "Deny connection",
            `Deny connection request${
                connection.patientName ? ` from ${connection.patientName}` : ""
            }?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Deny",
                    style: "destructive",
                    onPress: () => respondToConnection(connection.id, false),
                },
            ]
        );
    }

    async function copyUserCode() {
        if (!profile?.userCode) {
            Alert.alert("No code", "No clinician code is available to copy.");
            return;
        }

        try {
            await Clipboard.setStringAsync(profile.userCode);
            Alert.alert("Copied", "User code copied to clipboard.");
        } catch {
            Alert.alert("Error", "Could not copy your code.");
        }
    }

    async function saveProfile() {
        if (!editName.trim()) {
            Alert.alert("Missing name", "Please enter your name.");
            return;
        }

        try {
            setProfileSaving(true);

            const updated = await apiFetch("/api/users/me", {
                method: "PUT",
                body: JSON.stringify({
                    name: editName.trim(),
                    email: editEmail.trim(),
                }),
            });

            const nextProfile = normalizeProfile(updated) ?? {
                ...profile,
                name: editName.trim(),
                email: editEmail.trim(),
            };

            setProfile(nextProfile);
            setEditName(nextProfile?.name ?? editName.trim());
            setEditEmail(nextProfile?.email ?? editEmail.trim());

            Alert.alert("Saved", "Your profile was updated.");
        } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed to update profile.");
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
            Alert.alert("Mismatch", "New passwords do not match.");
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
            Alert.alert("Error", e?.message || "Failed to update password.");
        } finally {
            setPasswordSaving(false);
        }
    }

    function confirmLogout() {
        Alert.alert("Log out", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log Out",
                style: "destructive",
                onPress: async () => {
                    try {
                        await AsyncStorage.multiRemove(["token", "email", "role", "accountToken"]);
                        router.replace("/");
                    } catch {
                        Alert.alert("Error", "Failed to log out.");
                    }
                },
            },
        ]);
    }

    function openPatient(patient: ActivePatient) {
        if (!patient.patientId) {
            Alert.alert("Error", "Patient id is missing.");
            return;
        }

        router.push({
            pathname: "/clinician/exports",
            params: {
                patientId: patient.patientId,
                patientName: patient.patientName ?? "",
            },
        });
    }

    function renderPendingConnection(connection: PatientConnection) {
        const isBusy = loadingActionId === connection.id;

        return (
            <View key={connection.id} style={styles.connectionCard}>
                <Text style={styles.patientName}>
                    {connection.patientName || "Unnamed Patient"}
                </Text>

                {!!connection.patientEmail && (
                    <Text style={styles.connectionMeta}>{connection.patientEmail}</Text>
                )}

                {!!connection.patientCode && (
                    <Text style={styles.connectionMeta}>
                        Patient code: {connection.patientCode}
                    </Text>
                )}

                {!!connection.requestedAt && (
                    <Text style={styles.connectionMeta}>
                        Requested: {new Date(connection.requestedAt).toLocaleString()}
                    </Text>
                )}

                <Text style={styles.pendingText}>
                    This patient has requested to connect with you.
                </Text>

                <View style={styles.buttonRow}>
                    <Pressable
                        style={[styles.approveButton, isBusy && styles.disabled]}
                        onPress={() => !isBusy && confirmAccept(connection)}
                        disabled={isBusy}
                    >
                        {isBusy ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.approveButtonText}>Accept</Text>
                        )}
                    </Pressable>

                    <Pressable
                        style={[styles.denyButton, isBusy && styles.disabled]}
                        onPress={() => !isBusy && confirmDeny(connection)}
                        disabled={isBusy}
                    >
                        <Text style={styles.denyButtonText}>Deny</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    function renderActivePatient(patient: ActivePatient) {
        return (
            <Pressable
                key={patient.patientId}
                style={styles.connectionCard}
                onPress={() => openPatient(patient)}
            >
                <Text style={styles.patientName}>
                    {patient.patientName || "Unnamed Patient"}
                </Text>

                {!!patient.email && (
                    <Text style={styles.connectionMeta}>{patient.email}</Text>
                )}

                {!!patient.userCode && (
                    <Text style={styles.connectionMeta}>Patient code: {patient.userCode}</Text>
                )}

                <Text style={styles.activeText}>
                    Active connection. Tap to open patient exports.
                </Text>
            </Pressable>
        );
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                <Text style={styles.title}>More</Text>
                <Text style={styles.subtitle}>
                    Manage your account details, password, and patient connections.
                </Text>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Account</Text>

                    {screenLoading ? (
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
                                    <Text style={styles.name}>{profile.name || "N/A"}</Text>
                                    <Text style={styles.email}>{profile.email || "N/A"}</Text>
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Your code</Text>
                            <View style={styles.codeRow}>
                                <Text style={styles.userCodeText}>{profile.userCode || "N/A"}</Text>
                                <Pressable style={styles.copyButton} onPress={copyUserCode}>
                                    <Text style={styles.copyButtonText}>Copy</Text>
                                </Pressable>
                            </View>
                        </>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Active Patients</Text>
                    <Text style={styles.helperText}>
                        Search and open any patient you are actively connected to.
                    </Text>

                    <TextInput
                        value={patientSearch}
                        onChangeText={setPatientSearch}
                        style={styles.input}
                        placeholder="Search by name, email, or patient code"
                        placeholderTextColor="#6B7280"
                    />

                    {screenLoading ? (
                        <Text style={styles.helperText}>Loading active patients...</Text>
                    ) : filteredActivePatients.length === 0 ? (
                        <Text style={styles.helperText}>
                            {patientSearch.trim()
                                ? "No active patients match your search."
                                : "No active patient connections yet."}
                        </Text>
                    ) : (
                        filteredActivePatients.map(renderActivePatient)
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Update Profile</Text>

                    <Text style={styles.inputLabel}>Name</Text>
                    <TextInput
                        value={editName}
                        onChangeText={setEditName}
                        style={styles.input}
                        placeholder="Enter your name"
                        placeholderTextColor="#6B7280"
                    />

                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                        value={editEmail}
                        onChangeText={setEditEmail}
                        style={styles.input}
                        placeholder="Enter your email"
                        placeholderTextColor="#6B7280"
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <Pressable
                        style={[styles.primaryButton, profileSaving && styles.disabled]}
                        onPress={saveProfile}
                        disabled={profileSaving}
                    >
                        <Text style={styles.primaryButtonText}>
                            {profileSaving ? "Saving..." : "Save Profile"}
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
                    <Text style={styles.sectionTitle}>Pending Patient Connections</Text>
                    <Text style={styles.helperText}>
                        Review patient connection requests below. You can accept or deny each
                        request before any patient data is shared.
                    </Text>

                    {screenLoading ? (
                        <Text style={styles.helperText}>Loading connections...</Text>
                    ) : pendingConnections.length === 0 ? (
                        <Text style={styles.helperText}>No pending patient connections.</Text>
                    ) : (
                        pendingConnections.map(renderPendingConnection)
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Session</Text>

                    <Pressable style={styles.logoutButton} onPress={confirmLogout}>
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
        paddingBottom: 36,
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#1f2a44",
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 15,
        color: "#5f6b85",
        marginBottom: 16,
    },
    card: {
        backgroundColor: "white",
        borderRadius: 18,
        padding: 18,
        marginBottom: 16,
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
        marginRight: 10,
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
    connectionCard: {
        borderWidth: 1,
        borderColor: "#edf1f7",
        borderRadius: 16,
        padding: 14,
        marginTop: 12,
    },
    patientName: {
        fontSize: 16,
        fontWeight: "800",
        color: "#1f2a44",
        marginBottom: 4,
    },
    connectionMeta: {
        fontSize: 14,
        color: "#5f6b85",
        marginBottom: 4,
    },
    pendingText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#b45309",
        marginTop: 6,
    },
    activeText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#15803d",
        marginTop: 6,
    },
    buttonRow: {
        flexDirection: "row",
        marginTop: 8,
    },
    approveButton: {
        flex: 1,
        backgroundColor: "#1f2a44",
        paddingVertical: 12,
        borderRadius: 14,
        alignItems: "center",
        marginRight: 5,
    },
    approveButtonText: {
        color: "white",
        fontWeight: "800",
    },
    denyButton: {
        flex: 1,
        backgroundColor: "#eef2f7",
        paddingVertical: 12,
        borderRadius: 14,
        alignItems: "center",
        marginLeft: 5,
    },
    denyButtonText: {
        color: "#1f2a44",
        fontWeight: "800",
    },
    logoutButton: {
        backgroundColor: "#dc2626",
        borderRadius: 18,
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
    },
    logoutButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "800",
        marginLeft: 8,
    },
    disabled: {
        opacity: 0.7,
    },
});
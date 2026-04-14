import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    RefreshControl,
    Alert,
    TextInput,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { apiFetch } from "../../lib/api";

type ConnectedPatient = {
    patientId: string;
    patientName: string;
    email?: string;
    userCode?: string;
};

export default function ClinicianDashboard() {
    const router = useRouter();

    const [patients, setPatients] = useState<ConnectedPatient[]>([]);
    const [search, setSearch] = useState("");
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadPatients();
    }, []);

    async function loadPatients() {
        try {
            const data = await apiFetch("/api/clinician/patients");
            const list = Array.isArray(data) ? data : [];
            setPatients(list);
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to load connected patients.");
        }
    }

    async function onRefresh() {
        try {
            setRefreshing(true);
            await loadPatients();
        } finally {
            setRefreshing(false);
        }
    }

    const filteredPatients = useMemo(() => {
        const q = search.trim().toLowerCase();

        const sorted = [...patients].sort((a, b) =>
            (a.patientName || "").localeCompare(b.patientName || "", undefined, {
                sensitivity: "base",
            })
        );

        if (!q) return sorted;

        return sorted.filter((patient) => {
            const name = patient.patientName?.toLowerCase() ?? "";
            const email = patient.email?.toLowerCase() ?? "";
            const code = patient.userCode?.toLowerCase() ?? "";
            return name.includes(q) || email.includes(q) || code.includes(q);
        });
    }, [patients, search]);

    function openPatient(patient: ConnectedPatient) {
        router.push({
            pathname: "/exports",
            params: {
                patientId: patient.patientId,
                patientName: patient.patientName,
            },
        });
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                <Text style={styles.title}>Connected Patients</Text>

                <View style={styles.heroCard}>
                    <Text style={styles.heroTitle}>Clinician Review Workspace</Text>
                    <Text style={styles.heroText}>
                        Select a patient to review readable medication logs, symptom logs,
                        or both for a chosen date range. PAUL displays patient patterns and
                        recorded history only. It does not make medical recommendations.
                    </Text>
                </View>

                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search patients by name, email, or code..."
                    placeholderTextColor="#7b8794"
                    style={styles.searchInput}
                />

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Patient List</Text>

                    {filteredPatients.length === 0 ? (
                        <Text style={styles.empty}>No connected patients found.</Text>
                    ) : (
                        filteredPatients.map((patient) => (
                            <Pressable
                                key={patient.patientId}
                                style={styles.patientRow}
                                onPress={() => openPatient(patient)}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.patientName}>{patient.patientName}</Text>

                                    {!!patient.email && (
                                        <Text style={styles.patientMeta}>{patient.email}</Text>
                                    )}

                                    {!!patient.userCode && (
                                        <Text style={styles.patientMeta}>
                                            User code: {patient.userCode}
                                        </Text>
                                    )}
                                </View>

                                <View style={styles.openButton}>
                                    <Text style={styles.openButtonText}>Open</Text>
                                </View>
                            </Pressable>
                        ))
                    )}
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
        paddingBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#1f2a44",
    },
    heroCard: {
        backgroundColor: "#1f2a44",
        borderRadius: 22,
        padding: 20,
        gap: 10,
    },
    heroTitle: {
        color: "white",
        fontSize: 20,
        fontWeight: "800",
    },
    heroText: {
        color: "#e8edf7",
        lineHeight: 22,
        fontSize: 14,
    },
    searchInput: {
        backgroundColor: "white",
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: "#1f2a44",
    },
    card: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 18,
        gap: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#1f2a44",
    },
    empty: {
        color: "#7b8794",
        marginTop: 8,
    },
    patientRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#edf1f7",
    },
    patientName: {
        fontSize: 16,
        fontWeight: "800",
        color: "#1f2a44",
    },
    patientMeta: {
        fontSize: 13,
        color: "#5f6b85",
        marginTop: 3,
    },
    openButton: {
        backgroundColor: "#1f2a44",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    openButtonText: {
        color: "white",
        fontWeight: "800",
    },
});
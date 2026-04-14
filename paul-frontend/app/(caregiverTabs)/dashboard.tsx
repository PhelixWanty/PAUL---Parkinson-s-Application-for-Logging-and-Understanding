import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Alert,
    StyleSheet,
    RefreshControl,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch } from "../../lib/api";

type PatientProfile = {
    id: string;
    name: string;
    email?: string;
    userCode?: string;
};

type Medication = {
    id?: string;
    _id?: string;
    userId?: string;
    name: string;
    dosage?: string;
    times?: string[];
    active?: boolean;
};

type MedicationLog = {
    id?: string;
    _id?: string;
    userId?: string;
    medicationId: string;
    scheduledTime?: string;
    status: "TAKEN" | "MISSED";
    timestamp?: string;
    takenTime?: string;
};

type TodayDoseRow = {
    medicationId: string;
    medicationName: string;
    dosage?: string;
    scheduledTime: string;
    status: "TAKEN" | "MISSED" | "PENDING";
    displayTime: string;
};

function getId(m: Medication) {
    return m.id ?? m._id ?? "";
}

function parseHHMM(hhmm: string) {
    const [hStr, mStr] = hhmm.split(":");
    const h = Number(hStr);
    const m = Number(mStr);

    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return { h, m };
}

function formatTime(d: Date) {
    return d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
}

function isSameLocalDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function getStatusForDoseToday(
    logs: MedicationLog[],
    scheduledTime: string,
    today: Date
): "TAKEN" | "MISSED" | "PENDING" {
    const sameDoseLogs = logs.filter((log) => {
        if (log.scheduledTime !== scheduledTime) return false;
        if (!log.timestamp) return false;

        return isSameLocalDay(new Date(log.timestamp), today);
    });

    if (!sameDoseLogs.length) return "PENDING";

    const latest = sameDoseLogs.sort((a, b) => {
        const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bt - at;
    })[0];

    if (latest.status === "TAKEN") return "TAKEN";
    if (latest.status === "MISSED") return "MISSED";

    return "PENDING";
}

function buildTodayRows(
    medications: Medication[],
    logsByMedication: Record<string, MedicationLog[]>
): TodayDoseRow[] {
    const today = new Date();
    const rows: TodayDoseRow[] = [];

    for (const med of medications) {
        if (med.active === false) continue;

        const medId = getId(med);
        if (!medId) continue;

        const logs = logsByMedication[medId] ?? [];

        for (const t of med.times ?? []) {
            const parsed = parseHHMM(t);
            if (!parsed) continue;

            const scheduled = new Date();
            scheduled.setHours(parsed.h, parsed.m, 0, 0);

            rows.push({
                medicationId: medId,
                medicationName: med.name,
                dosage: med.dosage,
                scheduledTime: t,
                status: getStatusForDoseToday(logs, t, today),
                displayTime: formatTime(scheduled),
            });
        }
    }

    rows.sort((a, b) => {
        const at = parseHHMM(a.scheduledTime);
        const bt = parseHHMM(b.scheduledTime);

        if (!at || !bt) return 0;
        return at.h * 60 + at.m - (bt.h * 60 + bt.m);
    });

    return rows;
}

export default function CaregiverDashboard() {
    const [patient, setPatient] = useState<PatientProfile | null>(null);
    const [medications, setMedications] = useState<Medication[]>([]);
    const [logsByMedication, setLogsByMedication] = useState<Record<string, MedicationLog[]>>({});
    const [refreshing, setRefreshing] = useState(false);
    const [sendingReminderKey, setSendingReminderKey] = useState<string | null>(null);
    const [remindedKeys, setRemindedKeys] = useState<Record<string, boolean>>({});

    const todayRows = useMemo(
        () => buildTodayRows(medications, logsByMedication),
        [medications, logsByMedication]
    );

    useEffect(() => {
        loadAll();
    }, []);

    async function loadAll() {
        try {
            const [patientData, medicationData, todayLogs] = await Promise.all([
                apiFetch("/api/caregiver/patient"),
                apiFetch("/api/caregiver/patient/medications"),
                apiFetch("/api/caregiver/patient/medication-logs/today"),
            ]);

            setPatient(patientData ?? null);

            const meds = Array.isArray(medicationData) ? medicationData : [];
            const logs = Array.isArray(todayLogs) ? todayLogs : [];

            setMedications(meds);

            const grouped: Record<string, MedicationLog[]> = {};
            for (const log of logs) {
                const medId = log.medicationId;
                if (!grouped[medId]) grouped[medId] = [];
                grouped[medId].push(log);
            }

            setLogsByMedication(grouped);
        } catch (e: any) {
            console.log("Caregiver dashboard load error:", e);
            setPatient(null);
            setMedications([]);
            setLogsByMedication({});
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

    function rowKey(row: TodayDoseRow) {
        return `${row.medicationId}-${row.scheduledTime}`;
    }

    async function sendReminder(row: TodayDoseRow) {
        const key = rowKey(row);

        try {
            setSendingReminderKey(key);

            await apiFetch("/api/caregiver/patient/reminders", {
                method: "POST",
                body: JSON.stringify({
                    medicationId: row.medicationId,
                    scheduledTime: row.scheduledTime,
                    message: `Your caregiver sent you a reminder to take ${row.medicationName}.`,
                }),
            });

            setRemindedKeys((prev) => ({
                ...prev,
                [key]: true,
            }));

            Alert.alert(
                "Reminder sent",
                `A reminder was sent to ${patient?.name ?? "the patient"} for ${row.medicationName}.`
            );
        } catch (e: any) {
            Alert.alert(
                "Reminder failed",
                e?.message || "Could not send the reminder notification."
            );
        } finally {
            setSendingReminderKey(null);
        }
    }

    function statusColor(status: TodayDoseRow["status"]) {
        if (status === "TAKEN") return "#166534";
        if (status === "MISSED") return "#991B1B";
        return "#475569";
    }

    function statusBg(status: TodayDoseRow["status"]) {
        if (status === "TAKEN") return "#DCFCE7";
        if (status === "MISSED") return "#FEE2E2";
        return "#E2E8F0";
    }

    const totals = {
        taken: todayRows.filter((r) => r.status === "TAKEN").length,
        missed: todayRows.filter((r) => r.status === "MISSED").length,
        pending: todayRows.filter((r) => r.status === "PENDING").length,
    };

    const pendingRows = todayRows.filter((r) => r.status === "PENDING");

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <Text style={styles.title}>Caregiver Dashboard</Text>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Connected Patient</Text>

                    {!patient ? (
                        <Text style={styles.emptyText}>
                            No connected patient found yet. The patient must connect and both sides must approve.
                        </Text>
                    ) : (
                        <>
                            <Text style={styles.nameText}>{patient.name}</Text>
                            {!!patient.email && (
                                <Text style={styles.helperText}>{patient.email}</Text>
                            )}
                            {!!patient.userCode && (
                                <Text style={styles.helperText}>
                                    Patient code: {patient.userCode}
                                </Text>
                            )}
                        </>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Today’s Summary</Text>

                    {!patient ? (
                        <Text style={styles.emptyText}>No patient data to show yet.</Text>
                    ) : (
                        <View style={styles.summaryGrid}>
                            <View style={[styles.summaryBox, { backgroundColor: "#DCFCE7" }]}>
                                <Text style={styles.summaryValue}>{totals.taken}</Text>
                                <Text style={styles.summaryLabel}>Taken</Text>
                            </View>

                            <View style={[styles.summaryBox, { backgroundColor: "#FEE2E2" }]}>
                                <Text style={styles.summaryValue}>{totals.missed}</Text>
                                <Text style={styles.summaryLabel}>Missed</Text>
                            </View>

                            <View style={[styles.summaryBox, { backgroundColor: "#E2E8F0" }]}>
                                <Text style={styles.summaryValue}>{totals.pending}</Text>
                                <Text style={styles.summaryLabel}>Pending</Text>
                            </View>
                        </View>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Pending Medication Reminders</Text>

                    {!patient ? (
                        <Text style={styles.emptyText}>No patient data to show yet.</Text>
                    ) : pendingRows.length === 0 ? (
                        <Text style={styles.emptyText}>There are no pending medications right now.</Text>
                    ) : (
                        <View style={styles.listGap}>
                            {pendingRows.map((row, index) => {
                                const key = rowKey(row);
                                const isSending = sendingReminderKey === key;
                                const wasReminded = remindedKeys[key] === true;

                                return (
                                    <View
                                        key={`${row.medicationId}-${row.scheduledTime}-${index}`}
                                        style={styles.itemCard}
                                    >
                                        <View style={styles.rowBetweenTop}>
                                            <View style={styles.itemContent}>
                                                <Text style={styles.itemTitle}>
                                                    {row.medicationName}
                                                </Text>

                                                {!!row.dosage && (
                                                    <Text style={styles.itemSub}>{row.dosage}</Text>
                                                )}

                                                <Text style={styles.itemSub}>
                                                    Scheduled: {row.displayTime}
                                                </Text>
                                            </View>

                                            <View
                                                style={[
                                                    styles.statusPill,
                                                    { backgroundColor: statusBg(row.status) },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.statusPillText,
                                                        { color: statusColor(row.status) },
                                                    ]}
                                                >
                                                    {row.status}
                                                </Text>
                                            </View>
                                        </View>

                                        <Pressable
                                            style={[
                                                styles.remindButton,
                                                (isSending || wasReminded) && styles.remindButtonDisabled,
                                            ]}
                                            onPress={() => sendReminder(row)}
                                            disabled={isSending || wasReminded}
                                        >
                                            <Text style={styles.remindButtonText}>
                                                {isSending
                                                    ? "Sending..."
                                                    : wasReminded
                                                        ? "Reminder Sent"
                                                        : "Remind Patient"}
                                            </Text>
                                        </Pressable>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#B0B7BC" },
    container: { padding: 16, gap: 16, paddingBottom: 32 },

    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#1F2937",
    },

    card: {
        backgroundColor: "#F8FAFC",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#D7DEE3",
        gap: 12,
    },

    sectionTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#1F2937",
    },

    nameText: {
        fontSize: 18,
        fontWeight: "700",
        color: "#1F2937",
    },

    helperText: {
        color: "#64748B",
        fontSize: 14,
    },

    emptyText: {
        color: "#64748B",
        fontSize: 14,
    },

    summaryGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },

    summaryBox: {
        flexBasis: "48%",
        borderRadius: 14,
        padding: 14,
        alignItems: "center",
    },

    summaryValue: {
        fontSize: 24,
        fontWeight: "800",
        color: "#0F172A",
    },

    summaryLabel: {
        fontSize: 14,
        fontWeight: "700",
        color: "#334155",
    },

    listGap: {
        gap: 10,
    },

    itemCard: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 14,
        padding: 12,
        gap: 12,
    },

    rowBetweenTop: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
    },

    itemContent: {
        flex: 1,
        paddingRight: 12,
    },

    itemTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1F2937",
    },

    itemSub: {
        fontSize: 14,
        color: "#475569",
        marginTop: 2,
    },

    statusPill: {
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 12,
        minWidth: 84,
        alignItems: "center",
    },

    statusPillText: {
        fontSize: 12,
        fontWeight: "800",
    },

    remindButton: {
        backgroundColor: "#2563EB",
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
    },

    remindButtonDisabled: {
        opacity: 0.65,
    },

    remindButtonText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "800",
    },
});
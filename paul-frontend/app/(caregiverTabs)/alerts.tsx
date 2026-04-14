import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    RefreshControl,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch } from "../../lib/api";

type CaregiverAlert = {
    type: string;
    title: string;
    message: string;
    createdAt: string;
};

export default function CaregiverAlertsScreen() {
    const [alerts, setAlerts] = useState<CaregiverAlert[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        load();
    }, []);

    async function load() {
        try {
            const data = await apiFetch("/api/caregiver/alerts");
            setAlerts(Array.isArray(data) ? data : []);
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to load alerts");
        }
    }

    async function onRefresh() {
        try {
            setRefreshing(true);
            await load();
        } finally {
            setRefreshing(false);
        }
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <Text style={styles.title}>Caregiver Alerts</Text>

                {alerts.length === 0 ? (
                    <View style={styles.card}>
                        <Text style={styles.empty}>No alerts right now.</Text>
                    </View>
                ) : (
                    alerts.map((alert, i) => (
                        <View key={`${alert.type}-${i}`} style={styles.card}>
                            <Text style={styles.alertTitle}>{alert.title}</Text>
                            <Text style={styles.alertMessage}>{alert.message}</Text>
                            <Text style={styles.alertTime}>
                                {new Date(alert.createdAt).toLocaleString()}
                            </Text>
                        </View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#f7f8fb" },
    container: { padding: 20, gap: 14, paddingBottom: 32 },
    title: { fontSize: 28, fontWeight: "800", color: "#1f2a44" },
    card: { backgroundColor: "white", borderRadius: 20, padding: 18, gap: 8 },
    empty: { color: "#7b8794" },
    alertTitle: { fontSize: 17, fontWeight: "800", color: "#1f2a44" },
    alertMessage: { color: "#33415c", lineHeight: 22 },
    alertTime: { color: "#7b8794", fontSize: 12 },
});
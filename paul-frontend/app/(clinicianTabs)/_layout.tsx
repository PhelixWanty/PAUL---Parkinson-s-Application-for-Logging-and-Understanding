import { Tabs, Redirect } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function ClinicianTabsLayout() {
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        async function loadRole() {
            const storedRole = await AsyncStorage.getItem("role");
            setRole(storedRole);
            setLoading(false);
        }

        loadRole();
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    if (role !== "CLINICIAN") {
        return <Redirect href="/" />;
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: "#1f2a44",
                tabBarInactiveTintColor: "#7b8794",
                tabBarStyle: {
                    height: 72,
                    paddingTop: 8,
                    paddingBottom: 10,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: "700",
                },
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: "Patients",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="people-outline" size={size} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="exports"
                options={{
                    title: "Exports",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="document-text-outline" size={size} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="more"
                options={{
                    title: "More",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="menu-outline" size={size} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="summary"
                options={{
                    href: null,
                }}
            />

            <Tabs.Screen
                name="adherence"
                options={{
                    href: null,
                }}
            />

            <Tabs.Screen
                name="symptoms"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}
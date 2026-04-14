import { Tabs, Redirect } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function CaregiverTabsLayout() {
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string | null>(null);

    const screenWidth = Dimensions.get("window").width;
    const iconSize = screenWidth < 360 ? 20 : 24;

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

    if (role !== "CAREGIVER") {
        return <Redirect href="/" />;
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarActiveTintColor: "#2563EB",
                tabBarInactiveTintColor: "#64748B",
                tabBarStyle: {
                    height: 68,
                    paddingTop: 10,
                    paddingBottom: 10,
                },
                tabBarItemStyle: {
                    flex: 1,
                },
                tabBarIconStyle: {
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                },
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: "Dashboard",
                    tabBarIcon: ({ color }) => (
                        <Ionicons name="home-outline" size={iconSize} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="history"
                options={{
                    title: "History",
                    tabBarIcon: ({ color }) => (
                        <Ionicons name="time-outline" size={iconSize} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="alerts"
                options={{
                    title: "Alerts",
                    tabBarIcon: ({ color }) => (
                        <Ionicons name="notifications-outline" size={iconSize} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="more"
                options={{
                    title: "More",
                    tabBarIcon: ({ color }) => (
                        <Ionicons name="menu-outline" size={iconSize} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
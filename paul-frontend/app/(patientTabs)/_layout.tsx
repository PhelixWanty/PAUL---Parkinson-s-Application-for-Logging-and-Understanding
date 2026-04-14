import { Tabs, Redirect } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function PatientTabsLayout() {
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string | null>(null);
    const { width } = useWindowDimensions();

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

    if (role !== "PATIENT") {
        return <Redirect href="/" />;
    }

    const isSmallScreen = width < 380;

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarActiveTintColor: "#5c7cfa",
                tabBarInactiveTintColor: "#7b8798",
                tabBarStyle: {
                    height: isSmallScreen ? 56 : 62,
                    paddingTop: 6,
                    paddingBottom: 6,
                },
                tabBarItemStyle: {
                    flex: 1,
                },
                tabBarIconStyle: {
                    marginTop: 0,
                    marginBottom: 0,
                },
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: "Dashboard",
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons
                            name={focused ? "home" : "home-outline"}
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="medications"
                options={{
                    title: "Medications",
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons
                            name={focused ? "medkit" : "medkit-outline"}
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="symptoms"
                options={{
                    title: "Symptoms",
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons
                            name={focused ? "pulse" : "pulse-outline"}
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="history"
                options={{
                    title: "History",
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons
                            name={focused ? "time" : "time-outline"}
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="more"
                options={{
                    title: "More",
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons
                            name={focused ? "menu" : "menu-outline"}
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="reminders"
                options={{
                    href: null,
                }}
            />

            <Tabs.Screen
                name="share-settings"
                options={{
                    href: null,
                }}
            />

            <Tabs.Screen
                name="profile"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}
import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const items = [
    {
        label: "Reminders",
        icon: "notifications-outline",
        route: "/reminders",
        subtitle: "Manage medication reminder settings",
    },
    {
        label: "Sharing & Privacy",
        icon: "shield-checkmark-outline",
        route: "/share-settings",
        subtitle: "Control caregiver and clinician access",
    },
    {
        label: "Profile",
        icon: "person-circle-outline",
        route: "/profile",
        subtitle: "View your account, password, and logout",
    },
];

export default function MoreScreen() {
    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>More</Text>
                <Text style={styles.subtitle}>
                    Open settings, reminders, and account tools.
                </Text>

                {items.map((item) => (
                    <Pressable
                        key={item.label}
                        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                        onPress={() => router.push(item.route as any)}
                    >
                        <View style={styles.left}>
                            <View style={styles.iconWrap}>
                                <Ionicons name={item.icon as any} size={22} color="#1f2a44" />
                            </View>

                            <View style={styles.textWrap}>
                                <Text style={styles.label}>{item.label}</Text>
                                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                            </View>
                        </View>

                        <Ionicons name="chevron-forward" size={20} color="#7b8798" />
                    </Pressable>
                ))}
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
        gap: 14,
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
        marginBottom: 8,
    },
    card: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 18,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    pressed: {
        opacity: 0.9,
    },
    left: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        paddingRight: 10,
    },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: "#eef2ff",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    textWrap: {
        flex: 1,
    },
    label: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1f2a44",
    },
    cardSubtitle: {
        marginTop: 4,
        fontSize: 13,
        color: "#6b7280",
    },
});
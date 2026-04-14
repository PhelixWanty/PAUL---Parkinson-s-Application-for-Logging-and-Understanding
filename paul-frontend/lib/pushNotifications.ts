import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiFetch } from "./api";

export async function registerForPushNotificationsAndSaveToken() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== "granted") {
        throw new Error("Push notification permission not granted.");
    }

    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
            name: "Default",
            importance: Notifications.AndroidImportance.MAX,
        });
    }

    const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

    if (!projectId) {
        throw new Error("Missing EAS projectId in Expo config.");
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId,
    });

    const expoPushToken = tokenResponse.data;

    await apiFetch("/api/push-tokens/me", {
        method: "POST",
        body: JSON.stringify({
            expoPushToken,
            platform: Platform.OS,
        }),
    });

    return expoPushToken;
}
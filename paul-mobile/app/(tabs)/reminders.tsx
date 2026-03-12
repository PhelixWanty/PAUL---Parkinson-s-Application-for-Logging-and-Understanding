import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, Alert, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { apiFetch } from "../../lib/api";

// Make notifications show while app is open (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RemindersScreen() {
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  // Settings (sync with backend)
  const [enabled, setEnabled] = useState<boolean>(false);
  const [notifyIfMissed, setNotifyIfMissed] = useState<boolean>(true);
  const [missedAfterMinutes, setMissedAfterMinutes] = useState<string>("30");

  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  // ---- Notification Permissions ----
  async function requestPermission() {
    const { status } = await Notifications.requestPermissionsAsync();
    const granted = status === "granted";
    setPermissionGranted(granted);

    if (!granted) {
      Alert.alert(
        "Notifications Disabled",
        "Enable notifications in Settings to receive reminders."
      );
    }
  }

  // ---- Load settings from backend ----
  async function loadSettings() {
    try {
      setLoading(true);
      setStatusMsg("");
      const data = await apiFetch("/api/reminders/settings");
      setEnabled(!!data.enabled);
      setNotifyIfMissed(!!data.notifyIfMissed);
      setMissedAfterMinutes(String(data.missedAfterMinutes ?? 30));
    } catch (e: any) {
      // If backend not ready, still allow using local state
      setStatusMsg(`Could not load backend settings: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  // ---- Save settings to backend ----
  async function saveSettings() {
    const minutesNum = Number(missedAfterMinutes);
    if (Number.isNaN(minutesNum) || minutesNum < 1 || minutesNum > 240) {
      Alert.alert("Invalid", "Missed dose minutes must be between 1 and 240.");
      return;
    }

    try {
      setLoading(true);
      setStatusMsg("");
      await apiFetch("/api/reminders/settings", {
        method: "POST",
        body: JSON.stringify({
          enabled,
          notifyIfMissed,
          missedAfterMinutes: minutesNum,
        }),
      });
      setStatusMsg("Saved reminder settings ✅");
    } catch (e: any) {
      setStatusMsg(`Save failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  // ---- Local Notification Helpers (placeholder reminders) ----

  async function scheduleTestReminderIn10Sec() {
    if (!permissionGranted) {
      await requestPermission();
      if (!permissionGranted) return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "PAUL Reminder",
        body: "Time to take your medication (test reminder).",
      },
      trigger: { seconds: 10 },
    });

    Alert.alert("Scheduled", "Test reminder will fire in 10 seconds.");
  }

  async function scheduleDailyPlaceholder() {
    if (!permissionGranted) {
      await requestPermission();
      if (!permissionGranted) return;
    }

    // Example: schedule every day at 8:00 AM (placeholder)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "PAUL Daily Reminder",
        body: "Medication reminder (8:00 AM placeholder).",
      },
      trigger: {
        hour: 8,
        minute: 0,
        repeats: true,
      },
    });

    Alert.alert("Scheduled", "Daily placeholder reminder set for 8:00 AM.");
  }

  async function cancelAllReminders() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    Alert.alert("Cancelled", "All scheduled reminders were cancelled.");
  }

  // ---- Missed Dose Placeholder ----
  async function simulateMissedDose() {
    try {
      setStatusMsg("");
      await apiFetch("/api/reminders/simulate-missed", { method: "POST" });

      if (notifyIfMissed) {
        // Local notification placeholder
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Missed Dose Alert",
            body: `You may have missed a dose (placeholder).`,
          },
          trigger: { seconds: 2 },
        });
      }

      Alert.alert("Simulated", "Missed dose simulation triggered.");
    } catch (e: any) {
      setStatusMsg(`Simulate missed dose failed: ${e.message}`);
    }
  }

  // ---- init ----
  useEffect(() => {
    (async () => {
      // Check permission status quickly
      const existing = await Notifications.getPermissionsAsync();
      setPermissionGranted(existing.status === "granted");
      await loadSettings();
    })();
  }, []);

  return (
    <View style={{ padding: 20, gap: 14 }}>
      <Text style={{ fontSize: 26, fontWeight: "800" }}>Reminders</Text>

      <Text style={{ fontSize: 16 }}>
        Permission:{" "}
        <Text style={{ fontWeight: "800" }}>
          {permissionGranted ? "Granted ✅" : "Not granted ❌"}
        </Text>
      </Text>

      <Pressable
        onPress={requestPermission}
        style={{
          backgroundColor: "black",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>
          Enable Notifications
        </Text>
      </Pressable>

      <View style={{ borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 20, fontWeight: "800" }}>Settings</Text>

        <Pressable
          onPress={() => setEnabled((v) => !v)}
          style={{
            backgroundColor: enabled ? "green" : "gray",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>
            Reminders: {enabled ? "ON" : "OFF"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setNotifyIfMissed((v) => !v)}
          style={{
            backgroundColor: notifyIfMissed ? "green" : "gray",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>
            Missed Dose Alerts: {notifyIfMissed ? "ON" : "OFF"}
          </Text>
        </Pressable>

        <Text style={{ fontSize: 16, fontWeight: "700" }}>
          Consider missed after (minutes)
        </Text>
        <TextInput
          value={missedAfterMinutes}
          onChangeText={setMissedAfterMinutes}
          keyboardType="numeric"
          style={{
            borderWidth: 1,
            padding: 14,
            borderRadius: 12,
            fontSize: 18,
          }}
          placeholder="e.g. 30"
        />

        <Pressable
          onPress={saveSettings}
          disabled={loading}
          style={{
            backgroundColor: "black",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>
            {loading ? "Saving..." : "Save Settings"}
          </Text>
        </Pressable>

        {statusMsg ? (
          <Text style={{ fontSize: 14, color: "purple" }}>{statusMsg}</Text>
        ) : null}
      </View>

      <View style={{ borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 20, fontWeight: "800" }}>
          Reminder Placeholders
        </Text>

        <Pressable
          onPress={scheduleTestReminderIn10Sec}
          style={{
            backgroundColor: "black",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>
            Test Reminder (10 sec)
          </Text>
        </Pressable>

        <Pressable
          onPress={scheduleDailyPlaceholder}
          style={{
            backgroundColor: "black",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>
            Schedule Daily Placeholder (8:00 AM)
          </Text>
        </Pressable>

        <Pressable
          onPress={cancelAllReminders}
          style={{
            backgroundColor: "gray",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>
            Cancel All Reminders
          </Text>
        </Pressable>

        <Pressable
          onPress={simulateMissedDose}
          style={{
            backgroundColor: "#8b0000",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>
            Simulate Missed Dose
          </Text>
        </Pressable>

        <Text style={{ fontSize: 14, opacity: 0.8 }}>
          Note: These are placeholders for Sprint 2. Real reminders would be
          scheduled based on medication times and background tasks.
        </Text>
      </View>
    </View>
  );
}
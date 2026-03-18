import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { apiFetch } from "../../lib/api";

const MISSED_DOSE_CATEGORY_ID = "MISSED_DOSE_CATEGORY";
const MISSED_DOSE_CHANNEL_ID = "missed-dose-alerts";

const ACTION_DOSE_TAKEN = "DOSE_TAKEN";
const ACTION_REMIND_AGAIN = "REMIND_AGAIN";

// Foreground behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RemindersScreen() {
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  const [enabled, setEnabled] = useState<boolean>(false);
  const [notifyIfMissed, setNotifyIfMissed] = useState<boolean>(true);
  const [missedAfterMinutes, setMissedAfterMinutes] = useState<string>("30");

  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  const { width } = useWindowDimensions();
  const isSmallScreen = width < 430;

  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  async function setupNotificationFeatures() {
    // Android: create a high-priority channel so the alert is prominent
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(MISSED_DOSE_CHANNEL_ID, {
        name: "Missed dose alerts",
        description: "Alerts for missed medication doses",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 250, 300],
        enableVibrate: true,
        lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: "default",
      });
    }

    // Interactive actions shown on the notification
    await Notifications.setNotificationCategoryAsync(
        MISSED_DOSE_CATEGORY_ID,
        [
          {
            identifier: ACTION_DOSE_TAKEN,
            buttonTitle: "Dose Taken",
            options: {
              opensAppToForeground: true,
            },
          },
          {
            identifier: ACTION_REMIND_AGAIN,
            buttonTitle: "Remind Me Again",
            options: {
              opensAppToForeground: false,
            },
          },
        ]
    );
  }

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

    return granted;
  }

  async function ensureNotificationAccess() {
    let grantedNow = permissionGranted;

    if (!grantedNow) {
      const existing = await Notifications.getPermissionsAsync();
      grantedNow = existing.status === "granted";
      setPermissionGranted(grantedNow);
    }

    if (!grantedNow) {
      grantedNow = await requestPermission();
    }

    if (!grantedNow) return false;

    await setupNotificationFeatures();
    return true;
  }

  async function loadSettings() {
    try {
      setLoading(true);
      setStatusMsg("");
      const data = await apiFetch("/api/reminders/settings");
      setEnabled(!!data.enabled);
      setNotifyIfMissed(!!data.notifyIfMissed);
      setMissedAfterMinutes(String(data.missedAfterMinutes ?? 30));
    } catch (e: any) {
      setStatusMsg(`Could not load backend settings: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

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

  async function scheduleTestReminderIn10Sec() {
    const ok = await ensureNotificationAccess();
    if (!ok) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "PAUL Reminder",
        body: "Time to take your medication (test reminder).",
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 10,
        channelId: Platform.OS === "android" ? MISSED_DOSE_CHANNEL_ID : undefined,
      },
    });

    Alert.alert("Scheduled", "Test reminder will fire in 10 seconds.");
  }

  async function scheduleDailyPlaceholder() {
    const ok = await ensureNotificationAccess();
    if (!ok) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "PAUL Daily Reminder",
        body: "Medication reminder (8:00 AM placeholder).",
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 0,
        channelId: Platform.OS === "android" ? MISSED_DOSE_CHANNEL_ID : undefined,
      } as Notifications.DailyTriggerInput,
    });

    Alert.alert("Scheduled", "Daily placeholder reminder set for 8:00 AM.");
  }

  async function cancelAllReminders() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    Alert.alert("Cancelled", "All scheduled reminders were cancelled.");
  }

  async function scheduleMissedDoseAlert(delaySeconds = 1) {
    const ok = await ensureNotificationAccess();
    if (!ok) return;

    const placeholderMedication = {
      medicationName: "Lisinopril",
      dose: "10 mg",
      description: "Blood pressure medication placeholder reminder.",
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Missed Dose",
        body: `${placeholderMedication.medicationName} • ${placeholderMedication.dose}`,
        subtitle: "You may have missed this medication.",
        sound: "default",
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: MISSED_DOSE_CATEGORY_ID,
        data: {
          type: "missed-dose",
          medicationName: placeholderMedication.medicationName,
          dose: placeholderMedication.dose,
          description: placeholderMedication.description,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
        channelId: Platform.OS === "android" ? MISSED_DOSE_CHANNEL_ID : undefined,
      },
    });
  }

  async function simulateMissedDose() {
    try {
      setStatusMsg("");

      // Optional backend placeholder call
      await apiFetch("/api/reminders/simulate-missed", { method: "POST" });

      if (!notifyIfMissed) {
        Alert.alert(
            "Missed dose alerts are off",
            "Turn on missed dose alerts first."
        );
        return;
      }

      await scheduleMissedDoseAlert(1);

      Alert.alert(
          "Simulated",
          "A missed dose notification will appear with Dose Taken and Remind Me Again buttons."
      );
    } catch (e: any) {
      setStatusMsg(`Simulate missed dose failed: ${e.message}`);
    }
  }

  useEffect(() => {
    (async () => {
      const existing = await Notifications.getPermissionsAsync();
      const granted = existing.status === "granted";
      setPermissionGranted(granted);

      if (granted) {
        await setupNotificationFeatures();
      }

      await loadSettings();
    })();

    responseListener.current =
        Notifications.addNotificationResponseReceivedListener(async (response) => {
          const actionId = response.actionIdentifier;
          const data = response.notification.request.content.data as {
            medicationName?: string;
            dose?: string;
            description?: string;
          };

          const medName = data?.medicationName ?? "Medication";
          const dose = data?.dose ?? "Unknown dose";
          const description = data?.description ?? "Placeholder description";

          if (actionId === ACTION_DOSE_TAKEN) {
            Alert.alert(
                "Dose Taken",
                `${medName} (${dose}) marked as taken.\n\n${description}`
            );

            // Optional: if you later add a backend endpoint, call it here
            // await apiFetch("/api/medication-logs", { method: "POST", body: JSON.stringify(...) });
            return;
          }

          if (actionId === ACTION_REMIND_AGAIN) {
            await scheduleMissedDoseAlert(60);

            Alert.alert(
                "Reminder Rescheduled",
                `We will remind you again about ${medName} (${dose}) in 1 minute.`
            );
            return;
          }
        });

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        >
          <View style={[styles.header, isSmallScreen && styles.headerStacked]}>
            <Text style={styles.pageTitle}>Reminders</Text>

            <Pressable
                onPress={requestPermission}
                style={({ pressed }) => [
                  styles.headerButton,
                  pressed && styles.pressed,
                  isSmallScreen && styles.fullWidthButton,
                ]}
            >
              <Text style={styles.headerButtonText}>Enable Notifications</Text>
            </Pressable>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Notification Permission</Text>
            <Text
                style={[
                  styles.statusValue,
                  permissionGranted ? styles.statusGranted : styles.statusDenied,
                ]}
            >
              {permissionGranted ? "Granted ✅" : "Not granted ❌"}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Settings</Text>

            <Pressable
                onPress={() => setEnabled((v) => !v)}
                style={({ pressed }) => [
                  enabled ? styles.primaryAction : styles.inactiveAction,
                  pressed && styles.pressed,
                ]}
            >
              <Text style={styles.actionText}>
                Reminders: {enabled ? "ON" : "OFF"}
              </Text>
            </Pressable>

            <Pressable
                onPress={() => setNotifyIfMissed((v) => !v)}
                style={({ pressed }) => [
                  notifyIfMissed ? styles.primaryAction : styles.inactiveAction,
                  pressed && styles.pressed,
                ]}
            >
              <Text style={styles.actionText}>
                Missed Dose Alerts: {notifyIfMissed ? "ON" : "OFF"}
              </Text>
            </Pressable>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Consider missed after (minutes)
              </Text>
              <TextInput
                  value={missedAfterMinutes}
                  onChangeText={setMissedAfterMinutes}
                  keyboardType="numeric"
                  placeholder="e.g. 30"
                  placeholderTextColor="#6B7280"
                  style={styles.input}
              />
            </View>

            <Pressable
                onPress={saveSettings}
                disabled={loading}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  loading && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
            >
              <Text style={styles.actionText}>
                {loading ? "Saving..." : "Save Settings"}
              </Text>
            </Pressable>

            {statusMsg ? <Text style={styles.statusMsg}>{statusMsg}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Reminder Placeholders</Text>

            <View
                style={[styles.buttonGroup, isSmallScreen && styles.buttonColumn]}
            >
              <Pressable
                  onPress={scheduleTestReminderIn10Sec}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    pressed && styles.pressed,
                    isSmallScreen && styles.fullWidthAction,
                  ]}
              >
                <Text style={styles.actionText}>Test Reminder (10 sec)</Text>
              </Pressable>

              <Pressable
                  onPress={scheduleDailyPlaceholder}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    pressed && styles.pressed,
                    isSmallScreen && styles.fullWidthAction,
                  ]}
              >
                <Text style={styles.actionText}>Daily Placeholder (8:00 AM)</Text>
              </Pressable>
            </View>

            <View
                style={[styles.buttonGroup, isSmallScreen && styles.buttonColumn]}
            >
              <Pressable
                  onPress={cancelAllReminders}
                  style={({ pressed }) => [
                    styles.neutralAction,
                    pressed && styles.pressed,
                    isSmallScreen && styles.fullWidthAction,
                  ]}
              >
                <Text style={styles.actionText}>Cancel All Reminders</Text>
              </Pressable>

              <Pressable
                  onPress={simulateMissedDose}
                  style={({ pressed }) => [
                    styles.dangerAction,
                    pressed && styles.pressed,
                    isSmallScreen && styles.fullWidthAction,
                  ]}
              >
                <Text style={styles.actionText}>Simulate Missed Dose</Text>
              </Pressable>
            </View>

            <Text style={styles.noteText}>
              Tapping Simulate Missed Dose will create a placeholder missed-dose
              notification with action buttons for Dose Taken and Remind Me Again.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#B0B7BC",
  },
  container: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0B162A",
  },
  headerButton: {
    backgroundColor: "#0076B6",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 48,
  },
  headerButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  fullWidthButton: {
    width: "100%",
  },
  statusCard: {
    borderWidth: 1,
    borderColor: "#8A9298",
    borderRadius: 16,
    padding: 14,
    gap: 6,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B162A",
  },
  statusValue: {
    fontSize: 18,
    fontWeight: "900",
  },
  statusGranted: {
    color: "#0076B6",
  },
  statusDenied: {
    color: "#0B162A",
  },
  card: {
    borderWidth: 1,
    borderColor: "#8A9298",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0B162A",
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B162A",
  },
  input: {
    borderWidth: 1,
    borderColor: "#B0B7BC",
    backgroundColor: "#F7F8F9",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    fontSize: 18,
    color: "#0B162A",
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 10,
  },
  buttonColumn: {
    flexDirection: "column",
  },
  primaryAction: {
    flex: 1,
    backgroundColor: "#0076B6",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 50,
    justifyContent: "center",
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: "#0B162A",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 50,
    justifyContent: "center",
  },
  neutralAction: {
    flex: 1,
    backgroundColor: "#6B7280",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 50,
    justifyContent: "center",
  },
  inactiveAction: {
    backgroundColor: "#8A9298",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 50,
    justifyContent: "center",
  },
  dangerAction: {
    flex: 1,
    backgroundColor: "#7A1F1F",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 50,
    justifyContent: "center",
  },
  fullWidthAction: {
    width: "100%",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },
  statusMsg: {
    fontSize: 14,
    color: "#0076B6",
    fontWeight: "700",
  },
  noteText: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
});
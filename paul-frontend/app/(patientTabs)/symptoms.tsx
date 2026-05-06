import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { apiFetch } from "../../lib/api";

type SymptomCategory = "MOTOR" | "NON_MOTOR" | "MOOD" | "CUSTOM";
type SelectedSymptomCategory = SymptomCategory | null;

type SymptomFeeling = "GOOD" | "NEUTRAL" | "BAD";
type SelectedSymptomFeeling = SymptomFeeling | null;

type SymptomLog = {
  id: string;
  category: SymptomCategory;
  symptomName: string;
  severity: number;
  durationMinutes: number;
  feeling: SymptomFeeling;
  note?: string;
  createdAt: string;
};

type ActiveTracking = {
  id: string;
  category: SymptomCategory;
  symptomName: string;
  startedAt: string;
  currentSeverity: number;
  feeling: SymptomFeeling;
  note?: string;
  reminderIntervalMinutes: number;
  nextReminderAt: string;
  notificationId?: string;
  expanded?: boolean;
};

const TRACKING_STORAGE_KEY = "active_symptom_tracking_list_v1";

const SYMPTOM_REMINDER_CHANNEL_ID = "symptom-reminders";
const SYMPTOM_REMINDER_CATEGORY_ID = "SYMPTOM_REMINDER_CATEGORY";

const ACTION_STILL_EXPERIENCING = "STILL_EXPERIENCING";
const ACTION_SYMPTOM_OVER = "SYMPTOM_OVER";

const MOTOR_SYMPTOMS = [
  "Tremor",
  "Bradykinesia (slowness)",
  "Rigidity",
  "Freezing of gait",
  "Balance issues",
  "Dyskinesia",
  "Shuffling walk",
];

const NON_MOTOR_SYMPTOMS = [
  "Sleep problems",
  "Anxiety",
  "Depression",
  "Fatigue",
  "Constipation",
  "Cognitive difficulty",
  "Hallucinations",
  "Pain",
];

const MOOD_SYMPTOMS = [
  "Happy",
  "Calm",
  "Sad",
  "Anxious",
  "Irritable",
  "Frustrated",
  "Overwhelmed",
  "Motivated",
  "Low mood",
  "Mood swings",
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getCategoryLabel(category: SymptomCategory) {
  if (category === "MOTOR") return "Motor";
  if (category === "NON_MOTOR") return "Non-Motor";
  if (category === "MOOD") return "Mood";
  return "Custom";
}

function getFeelingLabel(feeling: SymptomFeeling) {
  if (feeling === "GOOD") return "Good";
  if (feeling === "NEUTRAL") return "Neutral";
  return "Bad";
}

function clampSeverity(n: number) {
  if (n < 1) return 1;
  if (n > 10) return 10;
  return n;
}

function normalizeCategory(value: any): SymptomCategory {
  if (value === "MOTOR") return "MOTOR";
  if (value === "NON_MOTOR") return "NON_MOTOR";
  if (value === "MOOD") return "MOOD";
  return "CUSTOM";
}

function normalizeFeeling(value: any): SymptomFeeling {
  if (value === "GOOD") return "GOOD";
  if (value === "NEUTRAL") return "NEUTRAL";
  return "BAD";
}

function normalizeLog(item: any): SymptomLog {
  return {
    id: item.id ?? item._id ?? String(Date.now() + Math.random()),
    category: normalizeCategory(item.category),
    symptomName: item.symptomName ?? "Unknown symptom",
    severity: Number(item.severity ?? 1),
    durationMinutes: Number(item.durationMinutes ?? 0),
    feeling: normalizeFeeling(item.feeling),
    note: item.note ?? undefined,
    createdAt: item.createdAt ?? new Date().toISOString(),
  };
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function minutesBetween(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

function addMinutesToIso(iso: string, minutes: number) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function makeTrackingId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function SymptomsScreen() {
  const [category, setCategory] = useState<SelectedSymptomCategory>(null);
  const [feeling, setFeeling] = useState<SelectedSymptomFeeling>(null);
  const [selectedCommon, setSelectedCommon] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");

  const [severity, setSeverity] = useState<number>(5);
  const [durationMinutes, setDurationMinutes] = useState<string>("30");
  const [note, setNote] = useState<string>("");
  const [trackingIntervalMinutes, setTrackingIntervalMinutes] =
      useState<string>("30");

  const [recent, setRecent] = useState<SymptomLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSymptomLog, setShowSymptomLog] = useState(true);

  const [activeTrackings, setActiveTrackings] = useState<ActiveTracking[]>([]);
  const [intervalEdits, setIntervalEdits] = useState<Record<string, string>>(
      {}
  );

  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTrackingId, setReminderTrackingId] = useState<string | null>(
      null
  );
  const [reminderSeverity, setReminderSeverity] = useState<number>(5);

  const [editOpen, setEditOpen] = useState(false);
  const [editLog, setEditLog] = useState<SymptomLog | null>(null);
  const [editCategory, setEditCategory] =
      useState<SelectedSymptomCategory>(null);
  const [editFeeling, setEditFeeling] =
      useState<SelectedSymptomFeeling>(null);
  const [editSelectedCommon, setEditSelectedCommon] = useState<string>("");
  const [editCustomName, setEditCustomName] = useState<string>("");
  const [editSeverity, setEditSeverity] = useState<number>(5);
  const [editDurationMinutes, setEditDurationMinutes] =
      useState<string>("30");
  const [editNote, setEditNote] = useState<string>("");

  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const { width } = useWindowDimensions();
  const isSmallScreen = width < 430;

  const commonList = useMemo(() => {
    if (category === "MOTOR") return MOTOR_SYMPTOMS;
    if (category === "NON_MOTOR") return NON_MOTOR_SYMPTOMS;
    if (category === "MOOD") return MOOD_SYMPTOMS;
    return [];
  }, [category]);

  const symptomName = useMemo(() => {
    if (!category) return "";
    if (category === "CUSTOM") return customName.trim();
    return selectedCommon.trim();
  }, [category, selectedCommon, customName]);

  const reminderTracking = useMemo(
      () => activeTrackings.find((t) => t.id === reminderTrackingId) ?? null,
      [activeTrackings, reminderTrackingId]
  );

  const editCommonList = useMemo(() => {
    if (editCategory === "MOTOR") return MOTOR_SYMPTOMS;
    if (editCategory === "NON_MOTOR") return NON_MOTOR_SYMPTOMS;
    if (editCategory === "MOOD") return MOOD_SYMPTOMS;
    return [];
  }, [editCategory]);

  const editSymptomName = useMemo(() => {
    if (!editCategory) return "";
    if (editCategory === "CUSTOM") return editCustomName.trim();
    return editSelectedCommon.trim();
  }, [editCategory, editSelectedCommon, editCustomName]);

  function resetForm() {
    setCategory(null);
    setFeeling(null);
    setSelectedCommon("");
    setCustomName("");
    setSeverity(5);
    setDurationMinutes("30");
    setNote("");
    setTrackingIntervalMinutes("30");
  }

  function setDefaultSelectionForCategory(nextCategory: SymptomCategory) {
    if (nextCategory === "MOTOR") {
      setSelectedCommon(MOTOR_SYMPTOMS[0]);
    } else if (nextCategory === "NON_MOTOR") {
      setSelectedCommon(NON_MOTOR_SYMPTOMS[0]);
    } else if (nextCategory === "MOOD") {
      setSelectedCommon(MOOD_SYMPTOMS[0]);
    } else {
      setSelectedCommon("");
    }
  }

  function setDefaultEditSelectionForCategory(nextCategory: SymptomCategory) {
    if (nextCategory === "MOTOR") {
      setEditSelectedCommon(MOTOR_SYMPTOMS[0]);
      setEditCustomName("");
    } else if (nextCategory === "NON_MOTOR") {
      setEditSelectedCommon(NON_MOTOR_SYMPTOMS[0]);
      setEditCustomName("");
    } else if (nextCategory === "MOOD") {
      setEditSelectedCommon(MOOD_SYMPTOMS[0]);
      setEditCustomName("");
    } else {
      setEditSelectedCommon("");
      setEditCustomName("");
    }
  }

  async function setupSymptomNotificationFeatures() {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(
          SYMPTOM_REMINDER_CHANNEL_ID,
          {
            name: "Symptom reminders",
            description: "Check-ins for tracked symptoms",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 150, 250],
            enableVibrate: true,
            lockscreenVisibility:
            Notifications.AndroidNotificationVisibility.PUBLIC,
          }
      );
    }

    await Notifications.setNotificationCategoryAsync(
        SYMPTOM_REMINDER_CATEGORY_ID,
        [
          {
            identifier: ACTION_STILL_EXPERIENCING,
            buttonTitle: "Still experiencing it",
            options: { opensAppToForeground: true },
          },
          {
            identifier: ACTION_SYMPTOM_OVER,
            buttonTitle: "Symptom is over",
            options: { opensAppToForeground: true },
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
          "Enable notifications in Settings to receive symptom reminders."
      );
    }

    return granted;
  }

  async function ensureSymptomNotificationAccess() {
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

    await setupSymptomNotificationFeatures();
    return true;
  }

  async function cancelTrackingNotification(notificationId?: string) {
    if (!notificationId) return;

    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // silent
    }
  }

  async function scheduleTrackingNotification(
      tracking: ActiveTracking
  ): Promise<string | undefined> {
    const ok = await ensureSymptomNotificationAccess();
    if (!ok) return undefined;

    const triggerDate = new Date(tracking.nextReminderAt);
    const secondsUntil = Math.max(
        1,
        Math.round((triggerDate.getTime() - Date.now()) / 1000)
    );

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Symptom check-in",
        body: `Are you still experiencing ${tracking.symptomName}?`,
        subtitle: `Severity: ${tracking.currentSeverity}/10`,
        categoryIdentifier: SYMPTOM_REMINDER_CATEGORY_ID,
        data: {
          type: "symptom-reminder",
          trackingId: tracking.id,
          symptomName: tracking.symptomName,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
        channelId:
            Platform.OS === "android" ? SYMPTOM_REMINDER_CHANNEL_ID : undefined,
      },
    });

    return id;
  }

  async function rescheduleTrackingNotification(
      tracking: ActiveTracking
  ): Promise<ActiveTracking> {
    await cancelTrackingNotification(tracking.notificationId);
    const notificationId = await scheduleTrackingNotification(tracking);
    return {
      ...tracking,
      notificationId,
    };
  }

  async function persistTrackings(next: ActiveTracking[]) {
    try {
      await AsyncStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // silent
    }
  }

  async function updateTrackings(next: ActiveTracking[]) {
    setActiveTrackings(next);
    await persistTrackings(next);
  }

  async function loadActiveTrackingsFromStorage() {
    try {
      const raw = await AsyncStorage.getItem(TRACKING_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const normalized: ActiveTracking[] = parsed
          .filter(
              (item: any) =>
                  item?.id &&
                  item?.symptomName &&
                  item?.startedAt &&
                  item?.nextReminderAt
          )
          .map((item: any) => ({
            id: String(item.id),
            category: normalizeCategory(item.category),
            symptomName: String(item.symptomName),
            startedAt: String(item.startedAt),
            currentSeverity: clampSeverity(Number(item.currentSeverity ?? 1)),
            feeling: normalizeFeeling(item.feeling),
            note: item.note ?? undefined,
            reminderIntervalMinutes: Number(item.reminderIntervalMinutes ?? 30),
            nextReminderAt: String(item.nextReminderAt),
            notificationId: item.notificationId
                ? String(item.notificationId)
                : undefined,
            expanded: false,
          }));

      setActiveTrackings(normalized);

      const nextEdits: Record<string, string> = {};
      normalized.forEach((t) => {
        nextEdits[t.id] = String(t.reminderIntervalMinutes);
      });
      setIntervalEdits(nextEdits);
    } catch {
      // silent
    }
  }

  async function loadRecentLogs(showErrorAlert = false) {
    try {
      setStatusMsg("");

      const data = await apiFetch("/api/symptoms");
      const logs = Array.isArray(data) ? data.map(normalizeLog) : [];

      logs.sort(
          (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setRecent(logs.slice(0, 50));
    } catch (e: any) {
      setStatusMsg("Could not load symptom logs from backend.");
      if (showErrorAlert) {
        Alert.alert("Refresh failed", e?.message || "Could not refresh logs.");
      }
    }
  }

  async function onRefresh() {
    try {
      setRefreshing(true);
      await loadRecentLogs(false);
    } finally {
      setRefreshing(false);
    }
  }

  async function saveLog() {
    const dur = Number(durationMinutes);

    if (!category) {
      Alert.alert("Missing category", "Please choose a symptom category.");
      return;
    }

    if (!feeling) {
      Alert.alert("Missing feeling", "Please choose Good, Neutral, or Bad.");
      return;
    }

    if (!symptomName) {
      Alert.alert("Missing", "Please enter or select a symptom.");
      return;
    }

    if (!Number.isFinite(dur) || dur < 0) {
      Alert.alert(
          "Invalid",
          "Duration must be a valid number of minutes (0 or more)."
      );
      return;
    }

    const payload = {
      category,
      symptomName,
      severity: clampSeverity(severity),
      durationMinutes: Math.floor(dur),
      feeling,
      note: note.trim() || undefined,
    };

    try {
      setSaving(true);
      setStatusMsg("");

      const saved = await apiFetch("/api/symptoms", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const created = normalizeLog(saved);

      setRecent((prev) =>
          [created, ...prev]
              .sort(
                  (a, b) =>
                      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              .slice(0, 50)
      );

      Alert.alert("Saved", "Symptom logged ✅");
      resetForm();
      setShowAddForm(false);
      setShowSymptomLog(true);
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Could not save symptom log.");
    } finally {
      setSaving(false);
    }
  }

  async function startTracking() {
    if (!category) {
      Alert.alert("Missing category", "Please choose a symptom category.");
      return;
    }

    if (!feeling) {
      Alert.alert("Missing feeling", "Please choose Good, Neutral, or Bad.");
      return;
    }

    if (!symptomName) {
      Alert.alert("Missing", "Please enter or select a symptom.");
      return;
    }

    const interval = Number(trackingIntervalMinutes);

    if (!Number.isFinite(interval) || interval <= 0) {
      Alert.alert(
          "Invalid reminder interval",
          "Please enter a valid reminder interval in minutes."
      );
      return;
    }

    const nowIso = new Date().toISOString();

    const trackingBase: ActiveTracking = {
      id: makeTrackingId(),
      category,
      symptomName,
      startedAt: nowIso,
      currentSeverity: clampSeverity(severity),
      feeling,
      note: note.trim() || undefined,
      reminderIntervalMinutes: Math.floor(interval),
      nextReminderAt: addMinutesToIso(nowIso, Math.floor(interval)),
      expanded: false,
    };

    const tracking = await rescheduleTrackingNotification(trackingBase);

    const next = [tracking, ...activeTrackings];
    setActiveTrackings(next);
    setIntervalEdits((prev) => ({
      ...prev,
      [tracking.id]: String(tracking.reminderIntervalMinutes),
    }));
    await persistTrackings(next);

    Alert.alert("Tracking started", `${tracking.symptomName} is now being tracked.`);
    setShowAddForm(false);
  }

  function setTrackingIntervalEdit(id: string, value: string) {
    setIntervalEdits((prev) => ({
      ...prev,
      [id]: value,
    }));
  }

  async function toggleTrackingExpanded(id: string) {
    const next = activeTrackings.map((t) =>
        t.id === id ? { ...t, expanded: !t.expanded } : t
    );
    await updateTrackings(next);
  }

  async function updateTrackingSeverity(id: string, delta: number) {
    const next = activeTrackings.map((t) =>
        t.id === id
            ? {
              ...t,
              currentSeverity: clampSeverity(t.currentSeverity + delta),
            }
            : t
    );
    await updateTrackings(next);
  }

  async function saveTrackingIntervalChange(id: string) {
    const tracking = activeTrackings.find((t) => t.id === id);
    if (!tracking) return;

    const interval = Number(intervalEdits[id] ?? tracking.reminderIntervalMinutes);

    if (!Number.isFinite(interval) || interval <= 0) {
      Alert.alert(
          "Invalid interval",
          "Reminder interval must be a valid number of minutes greater than 0."
      );
      return;
    }

    const nowIso = new Date().toISOString();

    const next = await Promise.all(
        activeTrackings.map(async (t) => {
          if (t.id !== id) return t;

          const updated: ActiveTracking = {
            ...t,
            reminderIntervalMinutes: Math.floor(interval),
            nextReminderAt: addMinutesToIso(nowIso, Math.floor(interval)),
          };

          return await rescheduleTrackingNotification(updated);
        })
    );

    await updateTrackings(next);
    Alert.alert("Updated", "Reminder interval updated.");
  }

  async function saveEndedTrackingLog(
      tracking: ActiveTracking,
      endIso: string,
      endedSeverity: number
  ) {
    const totalMinutes = minutesBetween(tracking.startedAt, endIso);

    const payload = {
      category: tracking.category,
      symptomName: tracking.symptomName,
      severity: clampSeverity(endedSeverity),
      durationMinutes: totalMinutes,
      feeling: tracking.feeling,
      note: tracking.note?.trim()
          ? `${tracking.note.trim()} | Tracked from ${new Date(
              tracking.startedAt
          ).toLocaleString()} to ${new Date(endIso).toLocaleString()}`
          : `Tracked from ${new Date(tracking.startedAt).toLocaleString()} to ${new Date(
              endIso
          ).toLocaleString()}`,
    };

    const saved = await apiFetch("/api/symptoms", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const created = normalizeLog(saved);

    setRecent((prev) =>
        [created, ...prev]
            .sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
            .slice(0, 50)
    );
  }

  async function endTrackingNow(id: string) {
    const tracking = activeTrackings.find((t) => t.id === id);
    if (!tracking) return;

    try {
      setSaving(true);
      const endIso = new Date().toISOString();

      await cancelTrackingNotification(tracking.notificationId);
      await saveEndedTrackingLog(tracking, endIso, tracking.currentSeverity);

      const next = activeTrackings.filter((t) => t.id !== id);
      setActiveTrackings(next);
      await persistTrackings(next);

      setIntervalEdits((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      if (reminderTrackingId === id) {
        setReminderTrackingId(null);
        setShowReminderModal(false);
      }

      setShowSymptomLog(true);

      Alert.alert(
          "Tracking ended",
          `${tracking.symptomName} has been saved to your symptom log.`
      );
    } catch (e: any) {
      Alert.alert(
          "Could not end tracking",
          e?.message || "Failed to save tracked symptom."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStillExperiencing() {
    if (!reminderTracking) return;

    const nowIso = new Date().toISOString();

    const next = await Promise.all(
        activeTrackings.map(async (t) => {
          if (t.id !== reminderTracking.id) return t;

          const updated: ActiveTracking = {
            ...t,
            currentSeverity: clampSeverity(reminderSeverity),
            nextReminderAt: addMinutesToIso(nowIso, t.reminderIntervalMinutes),
          };

          return await rescheduleTrackingNotification(updated);
        })
    );

    await updateTrackings(next);
    setShowReminderModal(false);
    setReminderTrackingId(null);
  }

  async function handleSymptomEndedFromReminder() {
    if (!reminderTracking) return;

    try {
      setSaving(true);
      const endIso = new Date().toISOString();

      await cancelTrackingNotification(reminderTracking.notificationId);
      await saveEndedTrackingLog(reminderTracking, endIso, reminderSeverity);

      const next = activeTrackings.filter((t) => t.id !== reminderTracking.id);
      setActiveTrackings(next);
      await persistTrackings(next);

      setIntervalEdits((prev) => {
        const copy = { ...prev };
        delete copy[reminderTracking.id];
        return copy;
      });

      setShowReminderModal(false);
      setReminderTrackingId(null);
      setShowSymptomLog(true);

      Alert.alert(
          "Logged",
          `${reminderTracking.symptomName} has been marked as over and saved.`
      );
    } catch (e: any) {
      Alert.alert(
          "Could not save symptom",
          e?.message || "Failed to save tracked symptom."
      );
    } finally {
      setSaving(false);
    }
  }

  function openEditLog(log: SymptomLog) {
    setEditLog(log);
    setEditCategory(log.category);
    setEditFeeling(log.feeling);
    setEditSeverity(clampSeverity(log.severity));
    setEditDurationMinutes(String(log.durationMinutes ?? 0));
    setEditNote(log.note ?? "");

    if (log.category === "CUSTOM") {
      setEditCustomName(log.symptomName ?? "");
      setEditSelectedCommon("");
    } else {
      setEditSelectedCommon(log.symptomName ?? "");
      setEditCustomName("");
    }

    setEditOpen(true);
  }

  function closeEditLog() {
    setEditOpen(false);
    setEditLog(null);
    setEditCategory(null);
    setEditFeeling(null);
    setEditSelectedCommon("");
    setEditCustomName("");
    setEditSeverity(5);
    setEditDurationMinutes("30");
    setEditNote("");
  }

  async function saveEditLog() {
    if (!editLog) return;

    const dur = Number(editDurationMinutes);

    if (!editCategory) {
      Alert.alert("Missing category", "Please choose a symptom category.");
      return;
    }

    if (!editFeeling) {
      Alert.alert("Missing feeling", "Please choose Good, Neutral, or Bad.");
      return;
    }

    if (!editSymptomName) {
      Alert.alert("Missing", "Please enter or select a symptom.");
      return;
    }

    if (!Number.isFinite(dur) || dur < 0) {
      Alert.alert(
          "Invalid",
          "Duration must be a valid number of minutes (0 or more)."
      );
      return;
    }

    try {
      setSaving(true);

      const updated = await apiFetch(`/api/symptoms/${editLog.id}`, {
        method: "PUT",
        body: JSON.stringify({
          category: editCategory,
          symptomName: editSymptomName,
          severity: clampSeverity(editSeverity),
          durationMinutes: Math.floor(dur),
          feeling: editFeeling,
          note: editNote.trim() || undefined,
        }),
      });

      const normalized = normalizeLog(updated);

      setRecent((prev) =>
          prev
              .map((item) => (item.id === normalized.id ? normalized : item))
              .sort(
                  (a, b) =>
                      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              .slice(0, 50)
      );

      closeEditLog();
      Alert.alert("Saved", "Symptom log updated.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Could not update symptom log.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteLog(log: SymptomLog) {
    Alert.alert(
        "Delete symptom log",
        `Delete "${log.symptomName}" from your log?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                setSaving(true);

                await apiFetch(`/api/symptoms/${log.id}`, {
                  method: "DELETE",
                });

                setRecent((prev) => prev.filter((item) => item.id !== log.id));

                if (editLog?.id === log.id) {
                  closeEditLog();
                }

                Alert.alert("Deleted", "Symptom log deleted.");
              } catch (e: any) {
                Alert.alert(
                    "Delete failed",
                    e?.message || "Could not delete symptom log."
                );
              } finally {
                setSaving(false);
              }
            },
          },
        ]
    );
  }

  useEffect(() => {
    (async () => {
      const existing = await Notifications.getPermissionsAsync();
      const granted = existing.status === "granted";
      setPermissionGranted(granted);

      if (granted) {
        await setupSymptomNotificationFeatures();
      }

      await loadRecentLogs(false);
      await loadActiveTrackingsFromStorage();
    })();
  }, []);

  useEffect(() => {
    responseListener.current =
        Notifications.addNotificationResponseReceivedListener(async (response) => {
          const actionId = response.actionIdentifier;
          const data = response.notification.request.content.data as {
            trackingId?: string;
          };

          const trackingId = data?.trackingId;
          if (!trackingId) return;

          const tracking = activeTrackings.find((t) => t.id === trackingId);
          if (!tracking) return;

          setReminderTrackingId(tracking.id);
          setReminderSeverity(tracking.currentSeverity);

          if (
              actionId === ACTION_STILL_EXPERIENCING ||
              actionId === Notifications.DEFAULT_ACTION_IDENTIFIER
          ) {
            setShowReminderModal(true);
            return;
          }

          if (actionId === ACTION_SYMPTOM_OVER) {
            await cancelTrackingNotification(tracking.notificationId);
            await saveEndedTrackingLog(
                tracking,
                new Date().toISOString(),
                tracking.currentSeverity
            );

            const next = activeTrackings.filter((t) => t.id !== tracking.id);
            setActiveTrackings(next);
            await persistTrackings(next);

            setIntervalEdits((prev) => {
              const copy = { ...prev };
              delete copy[tracking.id];
              return copy;
            });

            setShowReminderModal(false);
            setReminderTrackingId(null);

            Alert.alert(
                "Logged",
                `${tracking.symptomName} has been marked as over and saved.`
            );
          }
        });

    return () => {
      responseListener.current?.remove();
    };
  }, [activeTrackings]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (showReminderModal) return;

      const now = Date.now();
      const due = activeTrackings.find(
          (t) => new Date(t.nextReminderAt).getTime() <= now
      );

      if (due) {
        setReminderTrackingId(due.id);
        setReminderSeverity(due.currentSeverity);
        setShowReminderModal(true);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [activeTrackings, showReminderModal]);

  return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
          <View style={styles.header}>
            <Text style={styles.pageTitle}>Symptoms</Text>
            <Text style={styles.pageSubtitle}>
              Log symptoms, track them over time, and manage past entries.
            </Text>
          </View>

          {statusMsg ? (
              <View style={styles.statusCard}>
                <Text style={styles.statusMsg}>{statusMsg}</Text>
              </View>
          ) : null}

          <View style={styles.card}>
            <View style={[styles.topRow, isSmallScreen && styles.topRowStacked]}>
              <Text style={styles.sectionTitle}>Symptom actions</Text>

              <Pressable
                  onPress={() => setShowAddForm((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    pressed && styles.pressed,
                    isSmallScreen && styles.fullWidthButton,
                  ]}
              >
                <Text style={styles.actionText}>
                  {showAddForm ? "Hide Form" : "Add Symptom"}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.helperText}>Pull down to refresh.</Text>
            <Text style={styles.requiredHint}>
              Notifications: {permissionGranted ? "Enabled" : "Not enabled"}
            </Text>
          </View>

          {showAddForm ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Add or track symptom</Text>

                <Text style={styles.inputLabel}>Choose category *</Text>
                <View
                    style={[styles.categoryRow, isSmallScreen && styles.categoryColumn]}
                >
                  {(["MOTOR", "NON_MOTOR", "MOOD", "CUSTOM"] as SymptomCategory[]).map(
                      (c) => {
                        const active = category === c;

                        return (
                            <Pressable
                                key={c}
                                onPress={() => {
                                  setCategory(c);
                                  setDefaultSelectionForCategory(c);
                                }}
                                style={({ pressed }) => [
                                  styles.categoryButton,
                                  active
                                      ? styles.categoryButtonActive
                                      : styles.categoryButtonIdle,
                                  pressed && styles.pressed,
                                  isSmallScreen && styles.fullWidthButton,
                                ]}
                            >
                              <Text
                                  style={[
                                    styles.categoryButtonText,
                                    active && styles.categoryButtonTextActive,
                                  ]}
                              >
                                {getCategoryLabel(c)}
                              </Text>
                            </Pressable>
                        );
                      }
                  )}
                </View>

                {category ? (
                    <>
                      <Text style={styles.inputLabel}>Symptom</Text>

                      {category === "CUSTOM" ? (
                          <TextInput
                              value={customName}
                              onChangeText={setCustomName}
                              placeholder="Type your symptom"
                              placeholderTextColor="#6B7280"
                              style={styles.input}
                          />
                      ) : (
                          <View style={styles.chipWrap}>
                            {commonList.map((s) => {
                              const active = selectedCommon === s;

                              return (
                                  <Pressable
                                      key={s}
                                      onPress={() => setSelectedCommon(s)}
                                      style={({ pressed }) => [
                                        styles.chip,
                                        active ? styles.chipActive : styles.chipIdle,
                                        pressed && styles.pressed,
                                      ]}
                                  >
                                    <Text
                                        style={[
                                          styles.chipText,
                                          active && styles.chipTextActive,
                                        ]}
                                    >
                                      {s}
                                    </Text>
                                  </Pressable>
                              );
                            })}
                          </View>
                      )}

                      <Text style={styles.inputLabel}>Feeling *</Text>
                      <View
                          style={[styles.categoryRow, isSmallScreen && styles.categoryColumn]}
                      >
                        {(["GOOD", "NEUTRAL", "BAD"] as SymptomFeeling[]).map((f) => {
                          const active = feeling === f;

                          return (
                              <Pressable
                                  key={f}
                                  onPress={() => setFeeling(f)}
                                  style={({ pressed }) => [
                                    styles.feelingButton,
                                    active
                                        ? styles.feelingButtonActive
                                        : styles.feelingButtonIdle,
                                    pressed && styles.pressed,
                                    isSmallScreen && styles.fullWidthButton,
                                  ]}
                              >
                                <Text
                                    style={[
                                      styles.feelingButtonText,
                                      active && styles.feelingButtonTextActive,
                                    ]}
                                >
                                  {getFeelingLabel(f)}
                                </Text>
                              </Pressable>
                          );
                        })}
                      </View>

                      <Text style={styles.inputLabel}>Severity (1–10)</Text>
                      <View style={styles.severityRow}>
                        <Pressable
                            onPress={() => setSeverity((v) => clampSeverity(v - 1))}
                            style={({ pressed }) => [
                              styles.severityButton,
                              pressed && styles.pressed,
                            ]}
                        >
                          <Text style={styles.severityButtonText}>−</Text>
                        </Pressable>

                        <View style={styles.severityValueBox}>
                          <Text style={styles.severityValueText}>{severity}</Text>
                        </View>

                        <Pressable
                            onPress={() => setSeverity((v) => clampSeverity(v + 1))}
                            style={({ pressed }) => [
                              styles.severityButton,
                              pressed && styles.pressed,
                            ]}
                        >
                          <Text style={styles.severityButtonText}>+</Text>
                        </Pressable>
                      </View>

                      <Text style={styles.inputLabel}>Duration (minutes)</Text>
                      <TextInput
                          value={durationMinutes}
                          onChangeText={setDurationMinutes}
                          keyboardType="numeric"
                          placeholder="e.g. 30"
                          placeholderTextColor="#6B7280"
                          style={styles.input}
                      />

                      <Text style={styles.inputLabel}>
                        Tracking reminder interval (minutes)
                      </Text>
                      <TextInput
                          value={trackingIntervalMinutes}
                          onChangeText={setTrackingIntervalMinutes}
                          keyboardType="numeric"
                          placeholder="e.g. 30"
                          placeholderTextColor="#6B7280"
                          style={styles.input}
                      />

                      <Text style={styles.inputLabel}>Notes (optional)</Text>
                      <TextInput
                          value={note}
                          onChangeText={setNote}
                          placeholder="Anything else?"
                          placeholderTextColor="#6B7280"
                          style={[styles.input, styles.noteInput]}
                          multiline
                      />

                      <View
                          style={[styles.inlineRow, isSmallScreen && styles.inlineRowStacked]}
                      >
                        <Pressable
                            onPress={saveLog}
                            disabled={saving}
                            style={({ pressed }) => [
                              styles.secondaryAction,
                              styles.flexButton,
                              saving && styles.disabledButton,
                              pressed && styles.pressed,
                            ]}
                        >
                          <Text style={styles.actionText}>
                            {saving ? "Saving..." : "Save Log"}
                          </Text>
                        </Pressable>

                        <Pressable
                            onPress={startTracking}
                            disabled={saving}
                            style={({ pressed }) => [
                              styles.primaryAction,
                              styles.flexButton,
                              saving && styles.disabledButton,
                              pressed && styles.pressed,
                            ]}
                        >
                          <Text style={styles.actionText}>Start Tracking</Text>
                        </Pressable>
                      </View>
                    </>
                ) : null}
              </View>
          ) : null}

          {activeTrackings.length ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Currently tracking</Text>

                <View style={styles.logsList}>
                  {activeTrackings.map((tracking) => (
                      <View key={tracking.id} style={styles.logCard}>
                        <Pressable
                            onPress={() => toggleTrackingExpanded(tracking.id)}
                            style={styles.logHeaderButton}
                        >
                          <View style={styles.logHeaderTextWrap}>
                            <Text style={styles.logTitle}>
                              {tracking.symptomName} ({getCategoryLabel(tracking.category)})
                            </Text>
                            <Text style={styles.logText}>
                              Feeling: {getFeelingLabel(tracking.feeling)}
                            </Text>
                            <Text style={styles.logDate}>
                              Started: {formatDateTime(tracking.startedAt)}
                            </Text>
                          </View>

                          <Text style={styles.logHeaderChevron}>
                            {tracking.expanded ? "▴" : "▾"}
                          </Text>
                        </Pressable>

                        <View style={{ marginTop: 8 }}>
                          <Text style={styles.logText}>
                            Severity: {tracking.currentSeverity}/10
                          </Text>
                          <Text style={styles.logDate}>
                            Next reminder: {formatDateTime(tracking.nextReminderAt)}
                          </Text>
                          {tracking.note ? (
                              <Text style={styles.logText}>Note: {tracking.note}</Text>
                          ) : null}
                        </View>

                        {tracking.expanded ? (
                            <View style={styles.trackingExpandedBox}>
                              <View
                                  style={[
                                    styles.inlineRow,
                                    isSmallScreen && styles.inlineRowStacked,
                                    { marginTop: 0 },
                                  ]}
                              >
                                <Pressable
                                    onPress={() => updateTrackingSeverity(tracking.id, -1)}
                                    style={({ pressed }) => [
                                      styles.tertiaryAction,
                                      styles.flexButton,
                                      pressed && styles.pressed,
                                    ]}
                                >
                                  <Text style={styles.actionText}>Severity −</Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => updateTrackingSeverity(tracking.id, 1)}
                                    style={({ pressed }) => [
                                      styles.tertiaryAction,
                                      styles.flexButton,
                                      pressed && styles.pressed,
                                    ]}
                                >
                                  <Text style={styles.actionText}>Severity +</Text>
                                </Pressable>
                              </View>

                              <Text style={styles.inputLabel}>Reminder interval</Text>
                              <TextInput
                                  value={
                                      intervalEdits[tracking.id] ??
                                      String(tracking.reminderIntervalMinutes)
                                  }
                                  onChangeText={(value) =>
                                      setTrackingIntervalEdit(tracking.id, value)
                                  }
                                  keyboardType="numeric"
                                  placeholder="e.g. 30"
                                  placeholderTextColor="#6B7280"
                                  style={styles.input}
                              />

                              <View
                                  style={[
                                    styles.inlineRow,
                                    isSmallScreen && styles.inlineRowStacked,
                                  ]}
                              >
                                <Pressable
                                    onPress={() => saveTrackingIntervalChange(tracking.id)}
                                    style={({ pressed }) => [
                                      styles.secondaryAction,
                                      styles.flexButton,
                                      pressed && styles.pressed,
                                    ]}
                                >
                                  <Text style={styles.actionText}>Save Interval</Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => endTrackingNow(tracking.id)}
                                    disabled={saving}
                                    style={({ pressed }) => [
                                      styles.primaryAction,
                                      styles.flexButton,
                                      saving && styles.disabledButton,
                                      pressed && styles.pressed,
                                    ]}
                                >
                                  <Text style={styles.actionText}>End Tracking</Text>
                                </Pressable>
                              </View>
                            </View>
                        ) : null}
                      </View>
                  ))}
                </View>
              </View>
          ) : null}

          <View style={styles.card}>
            <View style={[styles.topRow, isSmallScreen && styles.topRowStacked]}>
              <Text style={styles.sectionTitle}>Symptom log</Text>

              <Pressable
                  onPress={() => setShowSymptomLog((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    pressed && styles.pressed,
                    isSmallScreen && styles.fullWidthButton,
                  ]}
              >
                <Text style={styles.actionText}>
                  {showSymptomLog ? "Hide Log" : "Show Log"}
                </Text>
              </Pressable>
            </View>

            {showSymptomLog ? (
                recent.length ? (
                    <View style={styles.logsList}>
                      {recent.map((r) => (
                          <View key={r.id} style={styles.logCard}>
                            <Text style={styles.logTitle}>
                              {r.symptomName} ({getCategoryLabel(r.category)})
                            </Text>

                            <Text style={styles.logText}>
                              Feeling: {getFeelingLabel(r.feeling)}
                            </Text>
                            <Text style={styles.logText}>Severity: {r.severity}/10</Text>
                            <Text style={styles.logText}>
                              Duration: {r.durationMinutes} minutes
                            </Text>
                            <Text style={styles.logDate}>
                              Logged: {formatDateTime(r.createdAt)}
                            </Text>

                            {r.note ? (
                                <Text style={styles.logText}>Note: {r.note}</Text>
                            ) : null}

                            <View
                                style={[
                                  styles.inlineRow,
                                  isSmallScreen && styles.inlineRowStacked,
                                ]}
                            >
                              <Pressable
                                  onPress={() => openEditLog(r)}
                                  style={({ pressed }) => [
                                    styles.primaryAction,
                                    styles.flexButton,
                                    pressed && styles.pressed,
                                  ]}
                              >
                                <Text style={styles.actionText}>Edit</Text>
                              </Pressable>

                              <Pressable
                                  onPress={() => confirmDeleteLog(r)}
                                  style={({ pressed }) => [
                                    styles.deleteAction,
                                    styles.flexButton,
                                    pressed && styles.pressed,
                                  ]}
                              >
                                <Text style={styles.actionText}>Delete</Text>
                              </Pressable>
                            </View>
                          </View>
                      ))}
                    </View>
                ) : (
                    <Text style={styles.emptyText}>No symptom logs yet.</Text>
                )
            ) : null}
          </View>
        </ScrollView>

        <Modal
            visible={showReminderModal}
            transparent
            animationType="fade"
            onRequestClose={() => {}}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>Symptom check-in</Text>

              <Text style={styles.modalText}>
                Are you still experiencing{" "}
                <Text style={styles.boldText}>{reminderTracking?.symptomName}</Text>?
              </Text>

              <Text style={styles.inputLabel}>Has the severity changed?</Text>

              <View style={styles.severityRow}>
                <Pressable
                    onPress={() => setReminderSeverity((v) => clampSeverity(v - 1))}
                    style={({ pressed }) => [
                      styles.severityButton,
                      pressed && styles.pressed,
                    ]}
                >
                  <Text style={styles.severityButtonText}>−</Text>
                </Pressable>

                <View style={styles.severityValueBox}>
                  <Text style={styles.severityValueText}>{reminderSeverity}</Text>
                </View>

                <Pressable
                    onPress={() => setReminderSeverity((v) => clampSeverity(v + 1))}
                    style={({ pressed }) => [
                      styles.severityButton,
                      pressed && styles.pressed,
                    ]}
                >
                  <Text style={styles.severityButtonText}>+</Text>
                </Pressable>
              </View>

              <View style={styles.modalButtonColumn}>
                <Pressable
                    onPress={handleStillExperiencing}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.secondaryAction,
                      styles.modalButton,
                      saving && styles.disabledButton,
                      pressed && styles.pressed,
                    ]}
                >
                  <Text style={styles.actionText}>Still experiencing it</Text>
                </Pressable>

                <Pressable
                    onPress={handleSymptomEndedFromReminder}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.primaryAction,
                      styles.modalButton,
                      saving && styles.disabledButton,
                      pressed && styles.pressed,
                    ]}
                >
                  <Text style={styles.actionText}>Symptom is over</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
            visible={editOpen}
            transparent
            animationType="slide"
            onRequestClose={closeEditLog}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionTitle}>Edit symptom log</Text>

                <Text style={styles.inputLabel}>Choose category *</Text>
                <View
                    style={[styles.categoryRow, isSmallScreen && styles.categoryColumn]}
                >
                  {(["MOTOR", "NON_MOTOR", "MOOD", "CUSTOM"] as SymptomCategory[]).map(
                      (c) => {
                        const active = editCategory === c;

                        return (
                            <Pressable
                                key={c}
                                onPress={() => {
                                  setEditCategory(c);
                                  setDefaultEditSelectionForCategory(c);
                                }}
                                style={({ pressed }) => [
                                  styles.categoryButton,
                                  active
                                      ? styles.categoryButtonActive
                                      : styles.categoryButtonIdle,
                                  pressed && styles.pressed,
                                  isSmallScreen && styles.fullWidthButton,
                                ]}
                            >
                              <Text
                                  style={[
                                    styles.categoryButtonText,
                                    active && styles.categoryButtonTextActive,
                                  ]}
                              >
                                {getCategoryLabel(c)}
                              </Text>
                            </Pressable>
                        );
                      }
                  )}
                </View>

                {editCategory ? (
                    <>
                      <Text style={styles.inputLabel}>Symptom</Text>

                      {editCategory === "CUSTOM" ? (
                          <TextInput
                              value={editCustomName}
                              onChangeText={setEditCustomName}
                              placeholder="Type your symptom"
                              placeholderTextColor="#6B7280"
                              style={styles.input}
                          />
                      ) : (
                          <View style={styles.chipWrap}>
                            {editCommonList.map((s) => {
                              const active = editSelectedCommon === s;

                              return (
                                  <Pressable
                                      key={s}
                                      onPress={() => setEditSelectedCommon(s)}
                                      style={({ pressed }) => [
                                        styles.chip,
                                        active ? styles.chipActive : styles.chipIdle,
                                        pressed && styles.pressed,
                                      ]}
                                  >
                                    <Text
                                        style={[
                                          styles.chipText,
                                          active && styles.chipTextActive,
                                        ]}
                                    >
                                      {s}
                                    </Text>
                                  </Pressable>
                              );
                            })}
                          </View>
                      )}

                      <Text style={styles.inputLabel}>Feeling *</Text>
                      <View
                          style={[
                            styles.categoryRow,
                            isSmallScreen && styles.categoryColumn,
                          ]}
                      >
                        {(["GOOD", "NEUTRAL", "BAD"] as SymptomFeeling[]).map((f) => {
                          const active = editFeeling === f;

                          return (
                              <Pressable
                                  key={f}
                                  onPress={() => setEditFeeling(f)}
                                  style={({ pressed }) => [
                                    styles.feelingButton,
                                    active
                                        ? styles.feelingButtonActive
                                        : styles.feelingButtonIdle,
                                    pressed && styles.pressed,
                                    isSmallScreen && styles.fullWidthButton,
                                  ]}
                              >
                                <Text
                                    style={[
                                      styles.feelingButtonText,
                                      active && styles.feelingButtonTextActive,
                                    ]}
                                >
                                  {getFeelingLabel(f)}
                                </Text>
                              </Pressable>
                          );
                        })}
                      </View>

                      <Text style={styles.inputLabel}>Severity (1–10)</Text>
                      <View style={styles.severityRow}>
                        <Pressable
                            onPress={() => setEditSeverity((v) => clampSeverity(v - 1))}
                            style={({ pressed }) => [
                              styles.severityButton,
                              pressed && styles.pressed,
                            ]}
                        >
                          <Text style={styles.severityButtonText}>−</Text>
                        </Pressable>

                        <View style={styles.severityValueBox}>
                          <Text style={styles.severityValueText}>{editSeverity}</Text>
                        </View>

                        <Pressable
                            onPress={() => setEditSeverity((v) => clampSeverity(v + 1))}
                            style={({ pressed }) => [
                              styles.severityButton,
                              pressed && styles.pressed,
                            ]}
                        >
                          <Text style={styles.severityButtonText}>+</Text>
                        </Pressable>
                      </View>

                      <Text style={styles.inputLabel}>Duration (minutes)</Text>
                      <TextInput
                          value={editDurationMinutes}
                          onChangeText={setEditDurationMinutes}
                          keyboardType="numeric"
                          placeholder="e.g. 30"
                          placeholderTextColor="#6B7280"
                          style={styles.input}
                      />

                      <Text style={styles.inputLabel}>Notes (optional)</Text>
                      <TextInput
                          value={editNote}
                          onChangeText={setEditNote}
                          placeholder="Anything else?"
                          placeholderTextColor="#6B7280"
                          style={[styles.input, styles.noteInput]}
                          multiline
                      />

                      <View
                          style={[
                            styles.inlineRow,
                            isSmallScreen && styles.inlineRowStacked,
                          ]}
                      >
                        <Pressable
                            onPress={closeEditLog}
                            style={({ pressed }) => [
                              styles.secondaryAction,
                              styles.flexButton,
                              pressed && styles.pressed,
                            ]}
                        >
                          <Text style={styles.actionText}>Cancel</Text>
                        </Pressable>

                        <Pressable
                            onPress={saveEditLog}
                            disabled={saving}
                            style={({ pressed }) => [
                              styles.primaryAction,
                              styles.flexButton,
                              saving && styles.disabledButton,
                              pressed && styles.pressed,
                            ]}
                        >
                          <Text style={styles.actionText}>
                            {saving ? "Saving..." : "Save Changes"}
                          </Text>
                        </Pressable>
                      </View>
                    </>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F7FB",
  },
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  header: {
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#123C69",
  },
  pageSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#4B5563",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statusCard: {
    backgroundColor: "#EAF4FF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#C9E2FF",
  },
  statusMsg: {
    color: "#123C69",
    fontSize: 14,
    fontWeight: "600",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  topRowStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#123C69",
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
  },
  requiredHint: {
    marginTop: 8,
    color: "#2A6FA8",
    fontSize: 13,
    fontWeight: "600",
  },
  inputLabel: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
  noteInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryColumn: {
    flexDirection: "column",
  },
  categoryButton: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryButtonIdle: {
    backgroundColor: "#F9FAFB",
    borderColor: "#D1D5DB",
  },
  categoryButtonActive: {
    backgroundColor: "#EAF4FF",
    borderColor: "#7CB4E8",
  },
  categoryButtonText: {
    color: "#374151",
    fontWeight: "700",
  },
  categoryButtonTextActive: {
    color: "#123C69",
  },
  feelingButton: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  feelingButtonIdle: {
    backgroundColor: "#F9FAFB",
    borderColor: "#D1D5DB",
  },
  feelingButtonActive: {
    backgroundColor: "#EAF4FF",
    borderColor: "#7CB4E8",
  },
  feelingButtonText: {
    color: "#374151",
    fontWeight: "700",
  },
  feelingButtonTextActive: {
    color: "#123C69",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  chipIdle: {
    backgroundColor: "#F9FAFB",
    borderColor: "#D1D5DB",
  },
  chipActive: {
    backgroundColor: "#EAF4FF",
    borderColor: "#7CB4E8",
  },
  chipText: {
    color: "#374151",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#123C69",
  },
  severityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginTop: 4,
  },
  severityButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#DCEBFA",
    alignItems: "center",
    justifyContent: "center",
  },
  severityButtonText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#123C69",
  },
  severityValueBox: {
    minWidth: 84,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  severityValueText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#123C69",
  },
  inlineRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  inlineRowStacked: {
    flexDirection: "column",
  },
  flexButton: {
    flex: 1,
  },
  primaryAction: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#123C69",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryAction: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#2A6FA8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tertiaryAction: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#4B7FB3",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  deleteAction: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#6C8FB3",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  disabledButton: {
    opacity: 0.55,
  },
  fullWidthButton: {
    width: "100%",
  },
  pressed: {
    opacity: 0.82,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 14,
    marginTop: 8,
  },
  logsList: {
    gap: 12,
    marginTop: 10,
  },
  logCard: {
    backgroundColor: "#F8FBFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#D8E8F8",
  },
  logTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 6,
  },
  logText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  logDate: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },
  trackingExpandedBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#D8E8F8",
  },
  logHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  logHeaderTextWrap: {
    flex: 1,
  },
  logHeaderChevron: {
    fontSize: 18,
    fontWeight: "800",
    color: "#123C69",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    alignSelf: "center",
  },
  modalText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#374151",
    marginBottom: 8,
  },
  boldText: {
    fontWeight: "800",
    color: "#111827",
  },
  modalButtonColumn: {
    marginTop: 16,
    gap: 12,
  },
  modalButton: {
    width: "100%",
  },
});
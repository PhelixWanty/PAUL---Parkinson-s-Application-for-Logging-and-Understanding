import React, { useEffect, useMemo, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  expanded?: boolean;
};

const TRACKING_STORAGE_KEY = "active_symptom_tracking_list_v1";

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

  const [activeTrackings, setActiveTrackings] = useState<ActiveTracking[]>([]);
  const [intervalEdits, setIntervalEdits] = useState<Record<string, string>>(
      {}
  );

  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTrackingId, setReminderTrackingId] = useState<string | null>(
      null
  );
  const [reminderSeverity, setReminderSeverity] = useState<number>(5);

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

  const latestThree = useMemo(() => recent.slice(0, 3), [recent]);

  const reminderTracking = useMemo(
      () => activeTrackings.find((t) => t.id === reminderTrackingId) ?? null,
      [activeTrackings, reminderTrackingId]
  );

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

  async function persistTrackings(next: ActiveTracking[]) {
    try {
      await AsyncStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // silent
    }
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

      setRecent(logs.slice(0, 20));
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
              .slice(0, 20)
      );

      Alert.alert("Saved", "Symptom logged ✅");
      resetForm();
      setShowAddForm(false);
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

    const tracking: ActiveTracking = {
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

  async function updateTrackings(next: ActiveTracking[]) {
    setActiveTrackings(next);
    await persistTrackings(next);
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

    const next = activeTrackings.map((t) =>
        t.id === id
            ? {
              ...t,
              reminderIntervalMinutes: Math.floor(interval),
              nextReminderAt: addMinutesToIso(nowIso, Math.floor(interval)),
            }
            : t
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
            .slice(0, 20)
    );
  }

  async function endTrackingNow(id: string) {
    const tracking = activeTrackings.find((t) => t.id === id);
    if (!tracking) return;

    try {
      setSaving(true);
      const endIso = new Date().toISOString();

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

    const next = activeTrackings.map((t) =>
        t.id === reminderTracking.id
            ? {
              ...t,
              currentSeverity: clampSeverity(reminderSeverity),
              nextReminderAt: addMinutesToIso(nowIso, t.reminderIntervalMinutes),
            }
            : t
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

      Alert.alert(
          "Logged",
          `${reminderTracking.symptomName} has been marked as over and saved.`
      );
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Could not save tracked symptom.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadRecentLogs(false);
    loadActiveTrackingsFromStorage();
  }, []);

  useEffect(() => {
    if (showReminderModal) return;
    if (activeTrackings.length === 0) return;

    const timer = setInterval(() => {
      const now = Date.now();

      const dueTracking = activeTrackings.find(
          (t) => now >= new Date(t.nextReminderAt).getTime()
      );

      if (dueTracking) {
        setReminderTrackingId(dueTracking.id);
        setReminderSeverity(dueTracking.currentSeverity);
        setShowReminderModal(true);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [activeTrackings, showReminderModal]);

  return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
          <View style={[styles.header, isSmallScreen && styles.headerStacked]}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.pageTitle}>Symptoms</Text>
              <Text style={styles.pageSubtitle}>Latest 3 symptom logs</Text>
            </View>

            <Pressable
                onPress={() => setShowAddForm((prev) => !prev)}
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.pressed,
                  isSmallScreen && styles.fullWidthButton,
                ]}
            >
              <Text style={styles.addButtonText}>
                {showAddForm ? "Close" : "Add Symptom"}
              </Text>
            </Pressable>
          </View>

          {activeTrackings.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Currently tracking</Text>

                {activeTrackings.map((tracking) => (
                    <View key={tracking.id} style={styles.trackingDropdownCard}>
                      <Pressable
                          onPress={() => toggleTrackingExpanded(tracking.id)}
                          style={({ pressed }) => [
                            styles.trackingDropdownHeader,
                            pressed && styles.pressed,
                          ]}
                      >
                        <View style={styles.trackingHeaderTextWrap}>
                          <Text style={styles.trackingSymptomTitle}>
                            {tracking.symptomName}
                          </Text>
                          <Text style={styles.trackingSummaryText}>
                            {getCategoryLabel(tracking.category)} • {getFeelingLabel(tracking.feeling)}
                          </Text>
                          <Text style={styles.trackingSummaryText}>
                            Severity {tracking.currentSeverity}/10
                          </Text>
                          <Text style={styles.trackingSummaryText}>
                            Every {tracking.reminderIntervalMinutes} min
                          </Text>
                        </View>

                        <Text style={styles.dropdownArrow}>
                          {tracking.expanded ? "▲" : "▼"}
                        </Text>
                      </Pressable>

                      {tracking.expanded ? (
                          <View style={styles.trackingDropdownBody}>
                            <Text style={styles.logText}>
                              Started: {formatDateTime(tracking.startedAt)}
                            </Text>
                            <Text style={styles.logText}>
                              Feeling: {getFeelingLabel(tracking.feeling)}
                            </Text>
                            <Text style={styles.logDate}>
                              Next reminder: {formatDateTime(tracking.nextReminderAt)}
                            </Text>

                            {tracking.note ? (
                                <Text style={styles.logText}>Note: {tracking.note}</Text>
                            ) : null}

                            <Text style={styles.inputLabel}>Change severity</Text>
                            <View style={styles.severityRow}>
                              <Pressable
                                  onPress={() => updateTrackingSeverity(tracking.id, -1)}
                                  style={({ pressed }) => [
                                    styles.severityButton,
                                    pressed && styles.pressed,
                                  ]}
                              >
                                <Text style={styles.severityButtonText}>−</Text>
                              </Pressable>

                              <View style={styles.severityValueBox}>
                                <Text style={styles.severityValueText}>
                                  {tracking.currentSeverity}
                                </Text>
                              </View>

                              <Pressable
                                  onPress={() => updateTrackingSeverity(tracking.id, 1)}
                                  style={({ pressed }) => [
                                    styles.severityButton,
                                    pressed && styles.pressed,
                                  ]}
                              >
                                <Text style={styles.severityButtonText}>+</Text>
                              </Pressable>
                            </View>

                            <Text style={styles.inputLabel}>
                              Change reminder interval (minutes)
                            </Text>

                            <View
                                style={[
                                  styles.inlineRow,
                                  isSmallScreen && styles.inlineRowStacked,
                                ]}
                            >
                              <TextInput
                                  value={intervalEdits[tracking.id] ?? ""}
                                  onChangeText={(value) =>
                                      setTrackingIntervalEdit(tracking.id, value)
                                  }
                                  keyboardType="numeric"
                                  placeholder="e.g. 30"
                                  placeholderTextColor="#6B7280"
                                  style={[styles.input, styles.flexInput]}
                              />

                              <Pressable
                                  onPress={() => saveTrackingIntervalChange(tracking.id)}
                                  style={({ pressed }) => [
                                    styles.secondaryAction,
                                    pressed && styles.pressed,
                                    isSmallScreen && styles.fullWidthButton,
                                  ]}
                              >
                                <Text style={styles.actionText}>Update interval</Text>
                              </Pressable>
                            </View>

                            <Pressable
                                onPress={() => endTrackingNow(tracking.id)}
                                disabled={saving}
                                style={({ pressed }) => [
                                  styles.endTrackingButton,
                                  saving && styles.disabledButton,
                                  pressed && styles.pressed,
                                ]}
                            >
                              <Text style={styles.actionText}>Mark symptom as over</Text>
                            </Pressable>
                          </View>
                      ) : null}
                    </View>
                ))}
              </View>
          ) : null}

          {statusMsg ? (
              <View style={styles.statusCard}>
                <Text style={styles.statusMsg}>{statusMsg}</Text>
              </View>
          ) : null}

          {showAddForm ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Add symptom</Text>

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

                {!category ? (
                    <Text style={styles.requiredHint}>
                      Please choose a category before entering the symptom.
                    </Text>
                ) : null}

                {category ? (
                    <>
                      <Text style={styles.inputLabel}>Symptom</Text>

                      {category === "CUSTOM" ? (
                          <TextInput
                              value={customName}
                              onChangeText={setCustomName}
                              placeholder="Type your symptom (e.g. dizziness)"
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
                                        style={[styles.chipText, active && styles.chipTextActive]}
                                    >
                                      {s}
                                    </Text>
                                  </Pressable>
                              );
                            })}
                          </View>
                      )}
                    </>
                ) : null}

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
                              active ? styles.feelingButtonActive : styles.feelingButtonIdle,
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

                {!feeling ? (
                    <Text style={styles.requiredHint}>
                      Please choose whether the symptom feels good, neutral, or bad.
                    </Text>
                ) : null}

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
                    placeholder="Anything else? triggers, context, etc."
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
                        styles.primaryAction,
                        styles.flexButton,
                        saving && styles.disabledButton,
                        pressed && styles.pressed,
                      ]}
                  >
                    <Text style={styles.actionText}>
                      {saving ? "Saving..." : "Log Symptom"}
                    </Text>
                  </Pressable>

                  <Pressable
                      onPress={startTracking}
                      disabled={saving}
                      style={({ pressed }) => [
                        styles.secondaryAction,
                        styles.flexButton,
                        saving && styles.disabledButton,
                        pressed && styles.pressed,
                      ]}
                  >
                    <Text style={styles.actionText}>Start Tracking</Text>
                  </Pressable>
                </View>
              </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recent symptoms</Text>

            {latestThree.length === 0 ? (
                <Text style={styles.emptyText}>No symptom logs yet.</Text>
            ) : (
                latestThree.map((r) => (
                    <View key={r.id} style={styles.logCard}>
                      <Text style={styles.logTitle}>
                        {r.symptomName} ({getCategoryLabel(r.category)})
                      </Text>

                      <Text style={styles.logText}>Feeling: {getFeelingLabel(r.feeling)}</Text>
                      <Text style={styles.logText}>Severity: {r.severity}/10</Text>
                      <Text style={styles.logText}>Duration: {r.durationMinutes} min</Text>
                      <Text style={styles.logDate}>
                        {new Date(r.createdAt).toLocaleString()}
                      </Text>

                      {r.note ? <Text style={styles.logText}>Note: {r.note}</Text> : null}
                    </View>
                ))
            )}
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

              <View style={styles.modalActions}>
                <Pressable
                    onPress={handleStillExperiencing}
                    style={({ pressed }) => [
                      styles.primaryAction,
                      pressed && styles.pressed,
                    ]}
                >
                  <Text style={styles.actionText}>Still experiencing it</Text>
                </Pressable>

                <Pressable
                    onPress={handleSymptomEndedFromReminder}
                    style={({ pressed }) => [
                      styles.endTrackingButton,
                      pressed && styles.pressed,
                    ]}
                >
                  <Text style={styles.actionText}>No, symptom is over</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
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
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0B162A",
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#444",
    fontWeight: "600",
  },
  addButton: {
    backgroundColor: "#0076B6",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  addButtonText: {
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
    backgroundColor: "#FFFFFF",
  },
  statusMsg: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0076B6",
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
  categoryRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  categoryColumn: {
    flexDirection: "column",
  },
  categoryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    minWidth: 120,
  },
  categoryButtonActive: {
    backgroundColor: "#0076B6",
    borderColor: "#0076B6",
  },
  categoryButtonIdle: {
    backgroundColor: "#F7F8F9",
    borderColor: "#B0B7BC",
  },
  categoryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0B162A",
  },
  categoryButtonTextActive: {
    color: "#FFFFFF",
  },
  feelingButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    minWidth: 100,
  },
  feelingButtonActive: {
    backgroundColor: "#0B162A",
    borderColor: "#0B162A",
  },
  feelingButtonIdle: {
    backgroundColor: "#F7F8F9",
    borderColor: "#B0B7BC",
  },
  feelingButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0B162A",
  },
  feelingButtonTextActive: {
    color: "#FFFFFF",
  },
  requiredHint: {
    fontSize: 14,
    fontWeight: "700",
    color: "#C62828",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: "#0B162A",
    borderColor: "#0B162A",
  },
  chipIdle: {
    backgroundColor: "#F7F8F9",
    borderColor: "#B0B7BC",
  },
  chipText: {
    fontWeight: "800",
    color: "#0B162A",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  severityRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  severityButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#0B162A",
    alignItems: "center",
    justifyContent: "center",
  },
  severityButtonText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  severityValueBox: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#B0B7BC",
    borderRadius: 12,
    backgroundColor: "#F7F8F9",
    alignItems: "center",
    justifyContent: "center",
  },
  severityValueText: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0076B6",
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
  flexInput: {
    flex: 1,
  },
  noteInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  primaryAction: {
    backgroundColor: "#0076B6",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  secondaryAction: {
    backgroundColor: "#0B162A",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  endTrackingButton: {
    backgroundColor: "#C62828",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    opacity: 0.7,
    color: "#0B162A",
  },
  logCard: {
    borderWidth: 1,
    borderColor: "#B0B7BC",
    borderRadius: 14,
    padding: 12,
    gap: 6,
    backgroundColor: "#F7F8F9",
  },
  logTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0B162A",
  },
  logText: {
    fontSize: 16,
    color: "#444",
  },
  logDate: {
    fontSize: 14,
    color: "#0076B6",
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
  inlineRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  inlineRowStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  flexButton: {
    flex: 1,
  },
  trackingDropdownCard: {
    borderWidth: 1,
    borderColor: "#B0B7BC",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#F7F8F9",
  },
  trackingDropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  trackingHeaderTextWrap: {
    flex: 1,
    gap: 4,
  },
  trackingSymptomTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0B162A",
  },
  trackingSummaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#444",
  },
  dropdownArrow: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0076B6",
  },
  trackingDropdownBody: {
    borderTopWidth: 1,
    borderTopColor: "#D1D5DB",
    padding: 12,
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11,22,42,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "#B0B7BC",
  },
  modalText: {
    fontSize: 16,
    color: "#0B162A",
  },
  boldText: {
    fontWeight: "900",
  },
  modalActions: {
    gap: 10,
  },
});
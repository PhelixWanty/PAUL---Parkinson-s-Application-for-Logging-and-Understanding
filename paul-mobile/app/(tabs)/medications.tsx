import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Modal,
  StyleSheet,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch } from "../../lib/api";

type Medication = {
  id?: string;
  _id?: string;
  name: string;
  dosage?: string;
  instructions?: string;
  times?: string[];
  active?: boolean;
};

type TimeEntry = {
  id: string;
  hour: string;
  minute: string;
  period: "AM" | "PM";
};

type DailyScheduleItem = {
  time24: string;
  displayTime: string;
  medications: Medication[];
};

function getId(m: Medication) {
  return m.id ?? m._id ?? "";
}

function makeTimeEntry(
    hour = "8",
    minute = "00",
    period: "AM" | "PM" = "AM"
): TimeEntry {
  return {
    id: `${Date.now()}-${Math.random()}`,
    hour,
    minute,
    period,
  };
}

function toStandardTime(time24: string) {
  if (!time24 || !time24.includes(":")) return time24;

  const [hStr, mStr] = time24.split(":");
  let hour = Number(hStr);
  const minute = Number(mStr);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return time24;

  const suffix: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function from24HourToEntry(time24: string): TimeEntry {
  if (!time24 || !time24.includes(":")) return makeTimeEntry();

  const [hStr, mStr] = time24.split(":");
  let hour = Number(hStr);
  const minute = Number(mStr);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return makeTimeEntry();

  const period: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return makeTimeEntry(String(hour), String(minute).padStart(2, "0"), period);
}

function entryTo24Hour(entry: TimeEntry) {
  let hour = Number(entry.hour);
  const minute = Number(entry.minute);

  if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      hour < 1 ||
      hour > 12 ||
      minute < 0 ||
      minute > 59
  ) {
    return null;
  }

  if (entry.period === "AM") {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function buildEntriesFromTimes(times?: string[]) {
  if (!times?.length) return [makeTimeEntry()];
  return times.map(from24HourToEntry);
}

function normalizeEntriesForApi(entries: TimeEntry[]) {
  const converted: string[] = [];

  for (const entry of entries) {
    const time24 = entryTo24Hour(entry);
    if (!time24) {
      return { ok: false as const, badValue: entry, times: [] as string[] };
    }
    converted.push(time24);
  }

  return { ok: true as const, times: converted };
}

function getPresetEntries(preset: "2" | "3" | "4"): TimeEntry[] {
  if (preset === "2") {
    return [
      makeTimeEntry("8", "00", "AM"),
      makeTimeEntry("8", "00", "PM"),
    ];
  }

  if (preset === "3") {
    return [
      makeTimeEntry("8", "00", "AM"),
      makeTimeEntry("2", "00", "PM"),
      makeTimeEntry("8", "00", "PM"),
    ];
  }

  return [
    makeTimeEntry("6", "00", "AM"),
    makeTimeEntry("12", "00", "PM"),
    makeTimeEntry("6", "00", "PM"),
    makeTimeEntry("10", "00", "PM"),
  ];
}

const HOURS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const MINUTES = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, "0")
);
const PERIODS: Array<"AM" | "PM"> = ["AM", "PM"];

function WheelPicker<T extends string>({
                                         label,
                                         data,
                                         selectedValue,
                                         onValueChange,
                                         visibleRows = 5,
                                       }: {
  label: string;
  data: T[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  visibleRows?: number;
}) {
  const ITEM_HEIGHT = 48;
  const pickerHeight = ITEM_HEIGHT * visibleRows;
  const centerOffset = (pickerHeight - ITEM_HEIGHT) / 2;
  const listRef = React.useRef<ScrollView>(null);

  const selectedIndex = Math.max(
      0,
      data.findIndex((item) => item === selectedValue)
  );

  React.useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    });
  }, [selectedIndex]);

  function snapToNearest(offsetY: number) {
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
    const nextValue = data[clampedIndex];

    listRef.current?.scrollTo({
      y: clampedIndex * ITEM_HEIGHT,
      animated: true,
    });

    if (nextValue !== selectedValue) {
      onValueChange(nextValue);
    }
  }

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    snapToNearest(e.nativeEvent.contentOffset.y);
  }

  return (
      <View style={styles.wheelBlock}>
        <Text style={styles.wheelLabel}>{label}</Text>

        <View style={[styles.wheelPickerContainer, { height: pickerHeight }]}>
          <ScrollView
              ref={listRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              bounces={false}
              nestedScrollEnabled
              contentContainerStyle={{
                paddingTop: centerOffset,
                paddingBottom: centerOffset,
              }}
              onMomentumScrollEnd={handleScrollEnd}
              onScrollEndDrag={handleScrollEnd}
              scrollEventThrottle={16}
          >
            {data.map((item) => {
              const selected = item === selectedValue;

              return (
                  <View
                      key={item}
                      style={[styles.wheelPickerItem, { height: ITEM_HEIGHT }]}
                  >
                    <Text
                        style={[
                          styles.wheelPickerItemText,
                          selected && styles.wheelPickerItemTextSelected,
                        ]}
                    >
                      {item}
                    </Text>
                  </View>
              );
            })}
          </ScrollView>

          <View
              pointerEvents="none"
              style={[
                styles.wheelPickerSelectionBox,
                {
                  top: centerOffset,
                  height: ITEM_HEIGHT,
                },
              ]}
          />
        </View>
      </View>
  );
}

function TimePickerRow({
                         entry,
                         onChange,
                         onRemove,
                         canRemove,
                       }: {
  entry: TimeEntry;
  onChange: (next: TimeEntry) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
      <View style={styles.timePickerCard}>
        <View style={styles.timePickerTopRow}>
          <Text style={styles.timePickerLabel}>Dose time</Text>
          {canRemove ? (
              <Pressable onPress={onRemove} style={styles.removeTimeButton}>
                <Text style={styles.removeTimeButtonText}>Remove</Text>
              </Pressable>
          ) : null}
        </View>

        <View style={styles.timeSelectorsRow}>
          <WheelPicker
              label="Hour"
              data={HOURS}
              selectedValue={entry.hour}
              onValueChange={(value) => onChange({ ...entry, hour: value })}
          />

          <WheelPicker
              label="Minute"
              data={MINUTES}
              selectedValue={entry.minute}
              onValueChange={(value) => onChange({ ...entry, minute: value })}
          />

          <WheelPicker
              label="AM / PM"
              data={PERIODS}
              selectedValue={entry.period}
              onValueChange={(value) =>
                  onChange({ ...entry, period: value as "AM" | "PM" })
              }
          />
        </View>
      </View>
  );
}

export default function MedicationsScreen() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDosage, setNewDosage] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [newTimes, setNewTimes] = useState<TimeEntry[]>([makeTimeEntry()]);

  const [editOpen, setEditOpen] = useState(false);
  const [editMed, setEditMed] = useState<Medication | null>(null);
  const [editName, setEditName] = useState("");
  const [editDosage, setEditDosage] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editTimes, setEditTimes] = useState<TimeEntry[]>([makeTimeEntry()]);
  const [editActive, setEditActive] = useState(true);

  const { width } = useWindowDimensions();
  const isSmallScreen = width < 430;

  async function loadMeds(showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      const data = await apiFetch("/api/medications");
      setMeds(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to load medications");
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function onRefresh() {
    try {
      setRefreshing(true);
      await loadMeds(false);
    } finally {
      setRefreshing(false);
    }
  }

  function updateNewTime(id: string, next: TimeEntry) {
    setNewTimes((prev) => prev.map((t) => (t.id === id ? next : t)));
  }

  function addNewTimeRow() {
    setNewTimes((prev) => [...prev, makeTimeEntry()]);
  }

  function removeNewTimeRow(id: string) {
    setNewTimes((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((t) => t.id !== id);
    });
  }

  function applyAddPreset(preset: "2" | "3" | "4") {
    setNewTimes(getPresetEntries(preset));
  }

  function updateEditTime(id: string, next: TimeEntry) {
    setEditTimes((prev) => prev.map((t) => (t.id === id ? next : t)));
  }

  function addEditTimeRow() {
    setEditTimes((prev) => [...prev, makeTimeEntry()]);
  }

  function removeEditTimeRow(id: string) {
    setEditTimes((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((t) => t.id !== id);
    });
  }

  function applyEditPreset(preset: "2" | "3" | "4") {
    setEditTimes(getPresetEntries(preset));
  }

  function openAdd() {
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
    setNewName("");
    setNewDosage("");
    setNewInstructions("");
    setNewTimes([makeTimeEntry()]);
  }

  async function addMedication() {
    if (!newName.trim()) {
      Alert.alert("Missing", "Medication name is required.");
      return;
    }

    const parsed = normalizeEntriesForApi(newTimes);
    if (!parsed.ok) {
      Alert.alert("Invalid time", "Please select a valid medication time.");
      return;
    }

    try {
      setLoading(true);

      await apiFetch("/api/medications", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          dosage: newDosage.trim() || undefined,
          instructions: newInstructions.trim() || undefined,
          times: parsed.times.length ? parsed.times : undefined,
          active: true,
        }),
      });

      await loadMeds(false);
      closeAdd();
      Alert.alert("Saved", "Medication added ✅");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to add medication");
    } finally {
      setLoading(false);
    }
  }

  function openEdit(m: Medication) {
    setEditMed(m);
    setEditName(m.name ?? "");
    setEditDosage(m.dosage ?? "");
    setEditInstructions(m.instructions ?? "");
    setEditTimes(buildEntriesFromTimes(m.times));
    setEditActive(m.active !== false);
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditMed(null);
    setEditName("");
    setEditDosage("");
    setEditInstructions("");
    setEditTimes([makeTimeEntry()]);
    setEditActive(true);
  }

  async function saveEdit() {
    if (!editMed) return;

    const id = getId(editMed);
    if (!id) {
      Alert.alert("Error", "This medication has no id. Backend must return id/_id.");
      return;
    }

    if (!editName.trim()) {
      Alert.alert("Missing", "Medication name is required.");
      return;
    }

    const parsed = normalizeEntriesForApi(editTimes);
    if (!parsed.ok) {
      Alert.alert("Invalid time", "Please select a valid medication time.");
      return;
    }

    try {
      setLoading(true);

      await apiFetch(`/api/medications/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          dosage: editDosage.trim() || undefined,
          instructions: editInstructions.trim() || undefined,
          times: parsed.times.length ? parsed.times : undefined,
          active: editActive,
        }),
      });

      await loadMeds(false);
      closeEdit();
      Alert.alert("Updated", "Medication updated ✅");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update medication");
    } finally {
      setLoading(false);
    }
  }

  async function deactivateMedication(m: Medication) {
    const id = getId(m);
    if (!id) {
      Alert.alert("Error", "This medication has no id. Backend must return id/_id.");
      return;
    }

    try {
      setLoading(true);

      await apiFetch(`/api/medications/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: m.name,
          dosage: m.dosage || undefined,
          instructions: m.instructions || undefined,
          times: m.times || [],
          active: false,
        }),
      });

      await loadMeds(false);
      Alert.alert("Deactivated", `"${m.name}" was deactivated.`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to deactivate medication");
    } finally {
      setLoading(false);
    }
  }

  async function reactivateMedication(m: Medication) {
    const id = getId(m);
    if (!id) {
      Alert.alert("Error", "This medication has no id. Backend must return id/_id.");
      return;
    }

    try {
      setLoading(true);

      await apiFetch(`/api/medications/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: m.name,
          dosage: m.dosage || undefined,
          instructions: m.instructions || undefined,
          times: m.times || [],
          active: true,
        }),
      });

      await loadMeds(false);
      Alert.alert("Reactivated", `"${m.name}" is active again.`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to reactivate medication");
    } finally {
      setLoading(false);
    }
  }

  async function deleteMedicationAndHistory(m: Medication) {
    const id = getId(m);
    if (!id) {
      Alert.alert("Error", "This medication has no id. Backend must return id/_id.");
      return;
    }

    try {
      setLoading(true);

      await apiFetch(`/api/medications/${id}?deleteLogs=true`, {
        method: "DELETE",
      });

      await loadMeds(false);
      Alert.alert("Deleted", `"${m.name}" and all of its history were deleted.`);
    } catch (e: any) {
      Alert.alert(
          "Error",
          e.message ||
          "Failed to delete medication and history. Make sure the backend supports ?deleteLogs=true."
      );
    } finally {
      setLoading(false);
    }
  }

  function confirmDeleteMedicationAndHistory(m: Medication) {
    Alert.alert(
        "Delete medication and history?",
        `You selected permanent deletion for "${m.name}". This will erase the medication and ALL log history for it. This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete Everything",
            style: "destructive",
            onPress: async () => {
              await deleteMedicationAndHistory(m);
            },
          },
        ]
    );
  }

  function promptDeleteChoice(m: Medication) {
    Alert.alert(
        "Remove medication",
        `What would you like to do with "${m.name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Deactivate Only",
            onPress: async () => {
              await deactivateMedication(m);
            },
          },
          {
            text: "Delete + Erase History",
            style: "destructive",
            onPress: () => confirmDeleteMedicationAndHistory(m),
          },
        ]
    );
  }

  useEffect(() => {
    loadMeds();
  }, []);

  const activeMeds = useMemo(
      () => meds.filter((m) => m.active !== false),
      [meds]
  );

  const inactiveMeds = useMemo(
      () => meds.filter((m) => m.active === false),
      [meds]
  );

  const dailySchedule = useMemo<DailyScheduleItem[]>(() => {
    const grouped: Record<string, Medication[]> = {};

    for (const med of activeMeds) {
      for (const time of med.times ?? []) {
        if (!grouped[time]) grouped[time] = [];
        grouped[time].push(med);
      }
    }

    return Object.keys(grouped)
        .sort((a, b) => a.localeCompare(b))
        .map((time24) => ({
          time24,
          displayTime: toStandardTime(time24),
          medications: grouped[time24].sort((a, b) =>
              (a.name || "").localeCompare(b.name || "")
          ),
        }));
  }, [activeMeds]);

  const hasActiveMeds = activeMeds.length > 0;
  const hasInactiveMeds = inactiveMeds.length > 0;

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
            <Text style={styles.pageTitle}>Medications</Text>
            <Text style={styles.helperText}>Pull down to refresh</Text>
          </View>

          <Pressable
              onPress={() => setScheduleOpen(true)}
              style={({ pressed }) => [
                styles.scheduleButton,
                pressed && styles.pressed,
              ]}
          >
            <Text style={styles.scheduleButtonText}>View Daily Schedule</Text>
          </Pressable>

          <View style={styles.card}>
            <View style={[styles.topRow, isSmallScreen && styles.topRowStacked]}>
              <Text style={styles.sectionTitle}>Active Medications</Text>

              <Pressable
                  onPress={openAdd}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    styles.addButton,
                    pressed && styles.pressed,
                    isSmallScreen && styles.fullWidthButton,
                  ]}
              >
                <Text style={styles.primaryButtonText}>Add Medication</Text>
              </Pressable>
            </View>

            {!hasActiveMeds ? (
                <Text style={styles.emptyText}>
                  No active medications yet. Tap Add Medication to create one.
                </Text>
            ) : (
                activeMeds.map((m) => (
                    <View
                        key={getId(m) || `${m.name}-${(m.times || []).join(",")}`}
                        style={styles.medCard}
                    >
                      <Text style={styles.medName}>{m.name}</Text>

                      {m.dosage ? (
                          <Text style={styles.medText}>Dosage: {m.dosage}</Text>
                      ) : null}

                      {m.instructions ? (
                          <Text style={styles.medText}>Directions: {m.instructions}</Text>
                      ) : null}

                      {m.times?.length ? (
                          <Text style={styles.medText}>
                            Times: {m.times.map(toStandardTime).join(", ")}
                          </Text>
                      ) : (
                          <Text style={styles.medMutedText}>Times: Not set</Text>
                      )}

                      <Text style={styles.medMutedText}>Status: Active</Text>

                      <View
                          style={[styles.actionRow, isSmallScreen && styles.actionColumn]}
                      >
                        <Pressable
                            onPress={() => openEdit(m)}
                            style={({ pressed }) => [
                              styles.primaryButton,
                              styles.actionButton,
                              pressed && styles.pressed,
                              isSmallScreen && styles.fullWidthButton,
                            ]}
                        >
                          <Text style={styles.primaryButtonText}>Edit</Text>
                        </Pressable>

                        <Pressable
                            onPress={() => promptDeleteChoice(m)}
                            style={({ pressed }) => [
                              styles.secondaryButton,
                              styles.actionButton,
                              pressed && styles.pressed,
                              isSmallScreen && styles.fullWidthButton,
                            ]}
                        >
                          <Text style={styles.secondaryButtonText}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                ))
            )}
          </View>

          <View style={styles.card}>
            <Pressable
                onPress={() => setInactiveOpen((v) => !v)}
                style={({ pressed }) => [
                  styles.inactiveToggle,
                  pressed && styles.pressed,
                ]}
            >
              <Text style={styles.sectionTitle}>
                Deactivated Medications ({inactiveMeds.length})
              </Text>
              <Text style={styles.inactiveToggleText}>
                {inactiveOpen ? "Hide" : "Show"}
              </Text>
            </Pressable>

            {inactiveOpen ? (
                hasInactiveMeds ? (
                    inactiveMeds.map((m) => (
                        <View
                            key={getId(m) || `${m.name}-${(m.times || []).join(",")}-inactive`}
                            style={styles.inactiveMedCard}
                        >
                          <Text style={styles.medName}>{m.name}</Text>

                          {m.dosage ? (
                              <Text style={styles.medText}>Dosage: {m.dosage}</Text>
                          ) : null}

                          {m.instructions ? (
                              <Text style={styles.medText}>Directions: {m.instructions}</Text>
                          ) : null}

                          {m.times?.length ? (
                              <Text style={styles.medText}>
                                Times: {m.times.map(toStandardTime).join(", ")}
                              </Text>
                          ) : (
                              <Text style={styles.medMutedText}>Times: Not set</Text>
                          )}

                          <Text style={styles.medMutedText}>Status: Inactive</Text>

                          <View
                              style={[styles.actionRow, isSmallScreen && styles.actionColumn]}
                          >
                            <Pressable
                                onPress={() => reactivateMedication(m)}
                                style={({ pressed }) => [
                                  styles.primaryButton,
                                  styles.actionButton,
                                  pressed && styles.pressed,
                                  isSmallScreen && styles.fullWidthButton,
                                ]}
                            >
                              <Text style={styles.primaryButtonText}>Reactivate</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => confirmDeleteMedicationAndHistory(m)}
                                style={({ pressed }) => [
                                  styles.secondaryButton,
                                  styles.actionButton,
                                  pressed && styles.pressed,
                                  isSmallScreen && styles.fullWidthButton,
                                ]}
                            >
                              <Text style={styles.secondaryButtonText}>Delete Forever</Text>
                            </Pressable>
                          </View>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>No deactivated medications.</Text>
                )
            ) : (
                <Text style={styles.helperText}>
                  Tap Show to view and reactivate inactive medications.
                </Text>
            )}
          </View>
        </ScrollView>

        <Modal visible={scheduleOpen} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalContent}
              >
                <Text style={styles.sectionTitle}>Daily Medication Schedule</Text>
                <Text style={styles.helperText}>
                  This is your summarized schedule for active medications.
                </Text>

                {!dailySchedule.length ? (
                    <Text style={styles.emptyText}>
                      No active medications with scheduled times yet.
                    </Text>
                ) : (
                    dailySchedule.map((group) => (
                        <View key={group.time24} style={styles.scheduleCard}>
                          <Text style={styles.scheduleTime}>{group.displayTime}</Text>

                          {group.medications.map((med) => (
                              <View
                                  key={`${group.time24}-${getId(med) || med.name}`}
                                  style={styles.scheduleMedicationRow}
                              >
                                <Text style={styles.scheduleMedicationName}>{med.name}</Text>

                                {med.dosage ? (
                                    <Text style={styles.scheduleMedicationDetails}>
                                      {med.dosage}
                                    </Text>
                                ) : null}

                                {med.instructions ? (
                                    <Text style={styles.scheduleMedicationDetails}>
                                      {med.instructions}
                                    </Text>
                                ) : null}
                              </View>
                          ))}
                        </View>
                    ))
                )}

                <Pressable
                    onPress={() => setScheduleOpen(false)}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.pressed,
                    ]}
                >
                  <Text style={styles.primaryButtonText}>Close</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={addOpen} animationType="slide" transparent>
          <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.modalOverlay}
          >
            <View style={styles.modalCard}>
              <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalContent}
              >
                <Text style={styles.sectionTitle}>Add Medication</Text>

                <Text style={styles.label}>Name</Text>
                <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="e.g., Carbidopa/Levodopa"
                    placeholderTextColor="#6B7280"
                    style={styles.input}
                />

                <Text style={styles.label}>Dosage (optional)</Text>
                <TextInput
                    value={newDosage}
                    onChangeText={setNewDosage}
                    placeholder="e.g., 25/100mg"
                    placeholderTextColor="#6B7280"
                    style={styles.input}
                />

                <Text style={styles.label}>Directions (optional)</Text>
                <TextInput
                    value={newInstructions}
                    onChangeText={setNewInstructions}
                    placeholder="e.g., Take with food"
                    placeholderTextColor="#6B7280"
                    style={[styles.input, styles.multilineInput]}
                    multiline
                />

                <Text style={styles.label}>Quick presets</Text>
                <View style={[styles.presetRow, isSmallScreen && styles.actionColumn]}>
                  <Pressable
                      onPress={() => applyAddPreset("2")}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.presetButton,
                        pressed && styles.pressed,
                        isSmallScreen && styles.fullWidthButton,
                      ]}
                  >
                    <Text style={styles.secondaryButtonText}>2x/day</Text>
                  </Pressable>

                  <Pressable
                      onPress={() => applyAddPreset("3")}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.presetButton,
                        pressed && styles.pressed,
                        isSmallScreen && styles.fullWidthButton,
                      ]}
                  >
                    <Text style={styles.secondaryButtonText}>3x/day</Text>
                  </Pressable>

                  <Pressable
                      onPress={() => applyAddPreset("4")}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.presetButton,
                        pressed && styles.pressed,
                        isSmallScreen && styles.fullWidthButton,
                      ]}
                  >
                    <Text style={styles.secondaryButtonText}>4x/day</Text>
                  </Pressable>
                </View>

                <View style={styles.timeHeaderRow}>
                  <Text style={styles.label}>Times</Text>
                  <Pressable onPress={addNewTimeRow} style={styles.smallAddTimeButton}>
                    <Text style={styles.smallAddTimeButtonText}>+ Add Time</Text>
                  </Pressable>
                </View>

                {newTimes.map((entry) => (
                    <TimePickerRow
                        key={entry.id}
                        entry={entry}
                        onChange={(next) => updateNewTime(entry.id, next)}
                        onRemove={() => removeNewTimeRow(entry.id)}
                        canRemove={newTimes.length > 1}
                    />
                ))}

                <View
                    style={[
                      styles.actionRow,
                      styles.modalActionRow,
                      isSmallScreen && styles.actionColumn,
                    ]}
                >
                  <Pressable
                      onPress={closeAdd}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.actionButton,
                        pressed && styles.pressed,
                        isSmallScreen && styles.fullWidthButton,
                      ]}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                      onPress={addMedication}
                      disabled={loading}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        styles.actionButton,
                        loading && styles.disabledButton,
                        pressed && styles.pressed,
                        isSmallScreen && styles.fullWidthButton,
                      ]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {loading ? "Saving..." : "Add Medication"}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={editOpen} animationType="slide" transparent>
          <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.modalOverlay}
          >
            <View style={styles.modalCard}>
              <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalContent}
              >
                <Text style={styles.sectionTitle}>Edit Medication</Text>

                <Text style={styles.label}>Name</Text>
                <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholderTextColor="#6B7280"
                    style={styles.input}
                />

                <Text style={styles.label}>Dosage</Text>
                <TextInput
                    value={editDosage}
                    onChangeText={setEditDosage}
                    placeholderTextColor="#6B7280"
                    style={styles.input}
                />

                <Text style={styles.label}>Directions</Text>
                <TextInput
                    value={editInstructions}
                    onChangeText={setEditInstructions}
                    placeholder="e.g., Take with food"
                    placeholderTextColor="#6B7280"
                    style={[styles.input, styles.multilineInput]}
                    multiline
                />

                <Text style={styles.label}>Quick presets</Text>
                <View style={[styles.presetRow, isSmallScreen && styles.actionColumn]}>
                  <Pressable
                      onPress={() => applyEditPreset("2")}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.presetButton,
                        pressed && styles.pressed,
                        isSmallScreen && styles.fullWidthButton,
                      ]}
                  >
                    <Text style={styles.secondaryButtonText}>2x/day</Text>
                  </Pressable>

                  <Pressable
                      onPress={() => applyEditPreset("3")}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.presetButton,
                        pressed && styles.pressed,
                        isSmallScreen && styles.fullWidthButton,
                      ]}
                  >
                    <Text style={styles.secondaryButtonText}>3x/day</Text>
                  </Pressable>

                  <Pressable
                      onPress={() => applyEditPreset("4")}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.presetButton,
                        pressed && styles.pressed,
                        isSmallScreen && styles.fullWidthButton,
                      ]}
                  >
                    <Text style={styles.secondaryButtonText}>4x/day</Text>
                  </Pressable>
                </View>

                <View style={styles.timeHeaderRow}>
                  <Text style={styles.label}>Times</Text>
                  <Pressable onPress={addEditTimeRow} style={styles.smallAddTimeButton}>
                    <Text style={styles.smallAddTimeButtonText}>+ Add Time</Text>
                  </Pressable>
                </View>

                {editTimes.map((entry) => (
                    <TimePickerRow
                        key={entry.id}
                        entry={entry}
                        onChange={(next) => updateEditTime(entry.id, next)}
                        onRemove={() => removeEditTimeRow(entry.id)}
                        canRemove={editTimes.length > 1}
                    />
                ))}

                <Pressable
                    onPress={() => setEditActive((v) => !v)}
                    style={({ pressed }) => [
                      styles.toggleButton,
                      pressed && styles.pressed,
                    ]}
                >
                  <Text style={styles.toggleButtonText}>
                    Active: {editActive ? "Yes" : "No"} (tap to toggle)
                  </Text>
                </Pressable>

                <View
                    style={[
                      styles.actionRow,
                      styles.modalActionRow,
                      isSmallScreen && styles.actionColumn,
                    ]}
                >
                  <Pressable
                      onPress={closeEdit}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        styles.actionButton,
                        pressed && styles.pressed,
                        isSmallScreen && styles.fullWidthButton,
                      ]}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                      onPress={saveEdit}
                      disabled={loading}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        styles.actionButton,
                        loading && styles.disabledButton,
                        pressed && styles.pressed,
                        isSmallScreen && styles.fullWidthButton,
                      ]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {loading ? "Saving..." : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
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
    gap: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0B162A",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  topRowStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  fullWidthButton: {
    width: "100%",
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.82,
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
  label: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B162A",
  },
  helperText: {
    fontSize: 14,
    color: "#4B5563",
  },
  input: {
    borderWidth: 1,
    borderColor: "#B0B7BC",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 17,
    backgroundColor: "#F7F8F9",
    color: "#0B162A",
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  presetRow: {
    flexDirection: "row",
    gap: 10,
  },
  presetButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: "#0076B6",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  addButton: {
    minWidth: 150,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: "#0B162A",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  emptyText: {
    fontSize: 15,
    opacity: 0.8,
    color: "#0B162A",
  },
  medCard: {
    borderWidth: 1,
    borderColor: "#B0B7BC",
    borderRadius: 14,
    padding: 12,
    gap: 8,
    backgroundColor: "#F7F8F9",
  },
  inactiveMedCard: {
    borderWidth: 1,
    borderColor: "#B0B7BC",
    borderRadius: 14,
    padding: 12,
    gap: 8,
    backgroundColor: "#EEF2F4",
  },
  medName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0B162A",
  },
  medText: {
    fontSize: 16,
    color: "#0B162A",
  },
  medMutedText: {
    fontSize: 16,
    color: "#4B5563",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionColumn: {
    flexDirection: "column",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11,22,42,0.45)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    maxHeight: "90%",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#8A9298",
    overflow: "hidden",
  },
  modalContent: {
    padding: 16,
    gap: 12,
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: "#0B162A",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#F7F8F9",
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0B162A",
  },
  modalActionRow: {
    marginTop: 6,
  },
  timeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  smallAddTimeButton: {
    backgroundColor: "#0076B6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  smallAddTimeButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },
  timePickerCard: {
    borderWidth: 1,
    borderColor: "#B0B7BC",
    borderRadius: 14,
    backgroundColor: "#F7F8F9",
    padding: 12,
    gap: 10,
  },
  timePickerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timePickerLabel: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0B162A",
  },
  removeTimeButton: {
    backgroundColor: "#0B162A",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  removeTimeButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
  timeSelectorsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  wheelBlock: {
    flex: 1,
  },
  wheelLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0B162A",
    marginBottom: 6,
    textAlign: "center",
  },
  wheelPickerContainer: {
    position: "relative",
    borderWidth: 1,
    borderColor: "#B0B7BC",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  wheelPickerSelectionBox: {
    position: "absolute",
    left: 6,
    right: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#0076B6",
    backgroundColor: "rgba(0, 118, 182, 0.10)",
  },
  wheelPickerItem: {
    justifyContent: "center",
    alignItems: "center",
  },
  wheelPickerItemText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#6B7280",
  },
  wheelPickerItemTextSelected: {
    color: "#0B162A",
    fontWeight: "900",
  },
  inactiveToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inactiveToggleText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0076B6",
  },
  scheduleButton: {
    backgroundColor: "#0B162A",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  scheduleCard: {
    borderWidth: 1,
    borderColor: "#B0B7BC",
    borderRadius: 14,
    padding: 12,
    gap: 10,
    backgroundColor: "#F7F8F9",
  },
  scheduleTime: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0076B6",
  },
  scheduleMedicationRow: {
    borderTopWidth: 1,
    borderTopColor: "#D1D5DB",
    paddingTop: 10,
    gap: 2,
  },
  scheduleMedicationName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0B162A",
  },
  scheduleMedicationDetails: {
    fontSize: 14,
    color: "#4B5563",
  },
});
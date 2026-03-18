import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
  RefreshControl,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { apiFetch } from "../../lib/api";

/* ---------- TYPES ---------- */

type Medication = {
  id?: string;
  _id?: string;
  name: string;
  dosage?: string;
  times?: string[];
  active?: boolean;
};

type MedicationLog = {
  id?: string;
  _id?: string;
  userId?: string;
  medicationId: string;
  scheduledTime?: string;
  status: "TAKEN" | "MISSED" | "SKIPPED";
  timestamp?: string;
};

type NextDose = {
  medicationId: string;
  medicationName: string;
  dosage?: string;
  scheduledTime: string;
  scheduledAt: string;
  displayTime: string;
};

type NextDoseGroup = {
  scheduledTime: string;
  scheduledAt: string;
  displayTime: string;
  medications: NextDose[];
};

type MissedDose = {
  medicationId: string;
  medicationName: string;
  dosage?: string;
  scheduledTime: string;
  scheduledAt: string;
  displayTime: string;
};

type TakenTimeEntry = {
  hour: string;
  minute: string;
  period: "AM" | "PM";
};

type UserProfile = {
  id?: string;
  name?: string;
  email?: string;
  userCode?: string;
};

/* ---------- HELPERS ---------- */

function getId(m: Medication) {
  return m.id ?? m._id ?? "";
}

function getDoseKey(dose: { medicationId: string; scheduledTime: string }) {
  return `${dose.medicationId}|${dose.scheduledTime}`;
}

function parseHHMM(hhmm: string) {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);

  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { h, m };
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSameLocalDay(a: Date, b: Date) {
  return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
  );
}

function hasStatusToday(
    logs: MedicationLog[],
    scheduledTime: string,
    today: Date,
    statuses: Array<MedicationLog["status"]>
) {
  return logs.some((log) => {
    if (!statuses.includes(log.status)) return false;
    if (log.scheduledTime !== scheduledTime) return false;
    if (!log.timestamp) return false;

    const loggedDate = new Date(log.timestamp);
    return isSameLocalDay(loggedDate, today);
  });
}

function isDoseTakenToday(
    logs: MedicationLog[],
    scheduledTime: string,
    today: Date
) {
  return hasStatusToday(logs, scheduledTime, today, ["TAKEN"]);
}

function isDoseResolvedToday(
    logs: MedicationLog[],
    scheduledTime: string,
    today: Date
) {
  return hasStatusToday(logs, scheduledTime, today, ["TAKEN", "MISSED", "SKIPPED"]);
}

function minutesBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 60000);
}

function from24HourToEntry(time24: string): TakenTimeEntry {
  if (!time24 || !time24.includes(":")) {
    return { hour: "8", minute: "00", period: "AM" };
  }

  const [hStr, mStr] = time24.split(":");
  let hour = Number(hStr);
  const minute = Number(mStr);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return { hour: "8", minute: "00", period: "AM" };
  }

  const period: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return {
    hour: String(hour),
    minute: String(minute).padStart(2, "0"),
    period,
  };
}

function entryTo24Hour(entry: TakenTimeEntry) {
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

function getInitialTakenEntry(scheduledTime?: string): TakenTimeEntry {
  const now = new Date();
  const now24 = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
  ).padStart(2, "0")}`;

  if (!scheduledTime) return from24HourToEntry(now24);

  const parsed = parseHHMM(scheduledTime);
  if (!parsed) return from24HourToEntry(now24);

  const scheduled = new Date();
  scheduled.setHours(parsed.h, parsed.m, 0, 0);

  const base = scheduled.getTime() <= now.getTime() ? now : scheduled;
  const base24 = `${String(base.getHours()).padStart(2, "0")}:${String(
      base.getMinutes()
  ).padStart(2, "0")}`;

  return from24HourToEntry(base24);
}

/* ---------- WHEEL PICKER ---------- */

const HOURS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
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

/* ---------- COMPUTE DOSES ---------- */

function computeTodayUpcomingDoses(
    meds: Medication[],
    logsByMed: Record<string, MedicationLog[]>
): NextDose[] {
  const now = new Date();
  const doses: NextDose[] = [];

  for (const med of meds) {
    if (med.active === false) continue;

    const medId = getId(med);
    if (!medId) continue;

    const logs = logsByMed[medId] ?? [];

    for (const t of med.times ?? []) {
      const parsed = parseHHMM(t);
      if (!parsed) continue;

      const scheduled = new Date();
      scheduled.setHours(parsed.h, parsed.m, 0, 0);

      if (scheduled.getTime() < now.getTime()) continue;
      if (isDoseTakenToday(logs, t, now)) continue;

      doses.push({
        medicationId: medId,
        medicationName: med.name,
        dosage: med.dosage,
        scheduledTime: t,
        scheduledAt: scheduled.toISOString(),
        displayTime: formatTime(scheduled),
      });
    }
  }

  doses.sort(
      (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  return doses;
}

function getNextDoseGroup(doses: NextDose[]): NextDoseGroup | null {
  if (!doses.length) return null;

  const first = doses[0];
  const meds = doses.filter((d) => d.scheduledTime === first.scheduledTime);

  return {
    scheduledTime: first.scheduledTime,
    scheduledAt: first.scheduledAt,
    displayTime: first.displayTime,
    medications: meds,
  };
}

function computeMissedDoses(
    meds: Medication[],
    logsByMed: Record<string, MedicationLog[]>
): MissedDose[] {
  const now = new Date();
  const missed: MissedDose[] = [];

  for (const med of meds) {
    if (med.active === false) continue;

    const medId = getId(med);
    if (!medId) continue;

    const logs = logsByMed[medId] ?? [];

    for (const t of med.times ?? []) {
      const parsed = parseHHMM(t);
      if (!parsed) continue;

      const scheduled = new Date();
      scheduled.setHours(parsed.h, parsed.m, 0, 0);

      const minsLate = minutesBetween(now, scheduled);

      if (minsLate < 30) continue;
      if (isDoseResolvedToday(logs, t, now)) continue;

      missed.push({
        medicationId: medId,
        medicationName: med.name,
        dosage: med.dosage,
        scheduledTime: t,
        scheduledAt: scheduled.toISOString(),
        displayTime: formatTime(scheduled),
      });
    }
  }

  missed.sort(
      (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  return missed;
}

/* ---------- COMPONENT ---------- */

export default function Dashboard() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [logsByMed, setLogsByMed] = useState<Record<string, MedicationLog[]>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [showMissedModal, setShowMissedModal] = useState(false);
  const [takenEntry, setTakenEntry] = useState<TakenTimeEntry>({
    hour: "8",
    minute: "00",
    period: "AM",
  });

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function loadData() {
    const medsData = await apiFetch("/api/medications");
    const medList = Array.isArray(medsData) ? medsData : [];
    setMeds(medList);

    const logsMap: Record<string, MedicationLog[]> = {};

    for (const m of medList) {
      const id = getId(m);
      if (!id) continue;

      try {
        const logs = await apiFetch(`/api/medication-logs/medication/${id}`);
        logsMap[id] = Array.isArray(logs) ? logs : [];
      } catch {
        logsMap[id] = [];
      }
    }

    setLogsByMed(logsMap);
  }

  async function loadProfile() {
    try {
      setProfileLoading(true);
      const data = await apiFetch("/api/users/me");
      setProfile(data ?? null);
      setEditName(data?.name ?? "");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load profile.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([loadData(), loadProfile()]);
    } finally {
      setRefreshing(false);
    }
  }

  const nextGroup = useMemo(
      () => getNextDoseGroup(computeTodayUpcomingDoses(meds, logsByMed)),
      [meds, logsByMed]
  );

  const missedDoses = useMemo(
      () => computeMissedDoses(meds, logsByMed),
      [meds, logsByMed]
  );

  const firstMissedDose = missedDoses[0] ?? null;

  function toggle(id: string) {
    setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function saveTaken() {
    if (!nextGroup) return;

    try {
      setSaving(true);

      const selectedDoses = nextGroup.medications.filter((dose) =>
          selectedIds.includes(dose.medicationId)
      );

      for (const dose of selectedDoses) {
        await apiFetch("/api/medication-logs", {
          method: "POST",
          body: JSON.stringify({
            medicationId: dose.medicationId,
            scheduledTime: dose.scheduledTime,
            status: "TAKEN",
          }),
        });
      }

      Alert.alert("Saved", "Medication logged ✅");
      setShowLogModal(false);
      setSelectedIds([]);
      await loadData();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save medication log.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmMissedDose() {
    if (!firstMissedDose) return;

    try {
      setSaving(true);

      await apiFetch("/api/medication-logs", {
        method: "POST",
        body: JSON.stringify({
          medicationId: firstMissedDose.medicationId,
          scheduledTime: firstMissedDose.scheduledTime,
          status: "MISSED",
        }),
      });

      Alert.alert("Saved", "Dose marked as missed.");
      setShowMissedModal(false);
      await loadData();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to mark dose as missed.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmTakenLate() {
    if (!firstMissedDose) return;

    const takenTime = entryTo24Hour(takenEntry);
    if (!takenTime) {
      Alert.alert("Invalid time", "Please choose a valid taken time.");
      return;
    }

    try {
      setSaving(true);

      await apiFetch("/api/medication-logs", {
        method: "POST",
        body: JSON.stringify({
          medicationId: firstMissedDose.medicationId,
          scheduledTime: firstMissedDose.scheduledTime,
          status: "TAKEN",
          takenTime,
        }),
      });

      Alert.alert("Saved", "Dose marked as taken.");
      setShowMissedModal(false);
      await loadData();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to mark dose as taken.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfileName() {
    if (!editName.trim()) {
      Alert.alert("Missing name", "Please enter your name.");
      return;
    }

    try {
      setProfileSaving(true);

      const updated = await apiFetch("/api/users/me", {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
        }),
      });

      setProfile(updated ?? { ...profile, name: editName.trim() });
      Alert.alert("Saved", "Your name was updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function changePassword() {
    if (!currentPassword.trim()) {
      Alert.alert("Missing password", "Please enter your current password.");
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert("Missing password", "Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Password too short", "New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords do not match", "Please make sure both new passwords match.");
      return;
    }

    try {
      setPasswordSaving(true);

      await apiFetch("/api/users/me/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Saved", "Your password was updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function copyUserCode() {
    if (!profile?.userCode) return;

    await Clipboard.setStringAsync(profile.userCode);
    Alert.alert("Copied", "User code copied to clipboard.");
  }

  useEffect(() => {
    loadData();
    loadProfile();
  }, []);

  return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
            contentContainerStyle={styles.container}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
          <Text style={styles.title}>Dashboard</Text>

          {firstMissedDose ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>You might have missed this dose</Text>

                <Text style={styles.warningMedName}>{firstMissedDose.medicationName}</Text>

                {firstMissedDose.dosage ? (
                    <Text style={styles.warningDose}>{firstMissedDose.dosage}</Text>
                ) : null}

                <Text style={styles.warningTime}>
                  Scheduled for {firstMissedDose.displayTime}
                </Text>

                <Pressable
                    style={styles.warningButton}
                    onPress={() => {
                      setTakenEntry(getInitialTakenEntry(firstMissedDose.scheduledTime));
                      setShowMissedModal(true);
                    }}
                >
                  <Text style={styles.warningButtonText}>Review this dose</Text>
                </Pressable>
              </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Next doses</Text>

            {!nextGroup ? (
                <Text style={styles.emptyText}>No upcoming doses</Text>
            ) : (
                <>
                  <Text style={styles.time}>{nextGroup.displayTime}</Text>

                  {nextGroup.medications.map((dose) => (
                      <View key={getDoseKey(dose)} style={styles.medBlock}>
                        <Text style={styles.medName}>{dose.medicationName}</Text>
                        {dose.dosage ? (
                            <Text style={styles.medDose}>{dose.dosage}</Text>
                        ) : null}
                      </View>
                  ))}

                  <Pressable
                      style={styles.primary}
                      onPress={() => {
                        setSelectedIds(nextGroup.medications.map((m) => m.medicationId));
                        setShowLogModal(true);
                      }}
                  >
                    <Text style={styles.btnText}>Log medications taken</Text>
                  </Pressable>
                </>
            )}
          </View>

          <Pressable
              style={styles.profileButton}
              onPress={() => setShowProfileModal(true)}
          >
            <Text style={styles.profileButtonText}>User Profile</Text>
          </Pressable>
        </ScrollView>

        <Modal visible={showLogModal} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <Text style={styles.sectionTitle}>Log medications</Text>

              {nextGroup?.medications.map((dose) => {
                const selected = selectedIds.includes(dose.medicationId);

                return (
                    <Pressable
                        key={dose.medicationId}
                        style={styles.row}
                        onPress={() => toggle(dose.medicationId)}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxOn]}>
                        <Text style={styles.checkboxText}>{selected ? "✓" : ""}</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.medName}>{dose.medicationName}</Text>
                        {dose.dosage ? (
                            <Text style={styles.medDose}>{dose.dosage}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                );
              })}

              <View style={styles.modalActions}>
                <Pressable
                    style={styles.secondary}
                    onPress={() => {
                      setShowLogModal(false);
                      setSelectedIds([]);
                    }}
                    disabled={saving}
                >
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>

                <Pressable
                    style={[styles.primary, saving && styles.disabledBtn]}
                    onPress={saveTaken}
                    disabled={saving}
                >
                  <Text style={styles.btnText}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showMissedModal} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <Text style={styles.sectionTitle}>Missed dose check</Text>

              {firstMissedDose ? (
                  <>
                    <View style={styles.missedSummary}>
                      <Text style={styles.medName}>{firstMissedDose.medicationName}</Text>
                      {firstMissedDose.dosage ? (
                          <Text style={styles.medDose}>{firstMissedDose.dosage}</Text>
                      ) : null}
                      <Text style={styles.missedSummaryText}>
                        Scheduled for {firstMissedDose.displayTime}
                      </Text>
                    </View>

                    <Text style={styles.subheading}>Was this taken?</Text>
                    <Text style={styles.smallLabel}>If yes, select the time:</Text>

                    <View style={styles.timeSelectorsRow}>
                      <WheelPicker
                          label="Hour"
                          data={HOURS}
                          selectedValue={takenEntry.hour}
                          onValueChange={(value) =>
                              setTakenEntry((prev) => ({ ...prev, hour: value }))
                          }
                      />

                      <WheelPicker
                          label="Minute"
                          data={MINUTES}
                          selectedValue={takenEntry.minute}
                          onValueChange={(value) =>
                              setTakenEntry((prev) => ({ ...prev, minute: value }))
                          }
                      />

                      <WheelPicker
                          label="AM / PM"
                          data={PERIODS}
                          selectedValue={takenEntry.period}
                          onValueChange={(value) =>
                              setTakenEntry((prev) => ({
                                ...prev,
                                period: value as "AM" | "PM",
                              }))
                          }
                      />
                    </View>

                    <Text style={styles.selectedTimeText}>
                      Selected time:{" "}
                      {`${takenEntry.hour}:${takenEntry.minute} ${takenEntry.period}`}
                    </Text>

                    <Pressable
                        style={[styles.primary, saving && styles.disabledBtn]}
                        onPress={confirmTakenLate}
                        disabled={saving}
                    >
                      <Text style={styles.btnText}>
                        {saving ? "Saving..." : "Confirm it was taken"}
                      </Text>
                    </Pressable>

                    <Pressable
                        style={[styles.missedButton, saving && styles.disabledBtn]}
                        onPress={confirmMissedDose}
                        disabled={saving}
                    >
                      <Text style={styles.missedButtonText}>Confirm missed dose</Text>
                    </Pressable>
                  </>
              ) : null}

              <Pressable
                  style={styles.secondary}
                  onPress={() => setShowMissedModal(false)}
                  disabled={saving}
              >
                <Text style={styles.secondaryText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={showProfileModal} transparent animationType="slide">
          <View style={styles.overlay}>
            <View style={styles.profileModal}>
              <ScrollView
                  contentContainerStyle={styles.profileScrollContent}
                  showsVerticalScrollIndicator={false}
              >
                <Text style={styles.sectionTitle}>User Profile</Text>

                {profileLoading ? (
                    <Text style={styles.emptyText}>Loading profile...</Text>
                ) : (
                    <>
                      <View style={styles.profileCard}>
                        <Text style={styles.profileLabel}>Email</Text>
                        <Text style={styles.profileValue}>{profile?.email || "No email"}</Text>

                        <Text style={styles.profileLabel}>User Code</Text>
                        <View style={styles.codeRow}>
                          <Text style={styles.userCodeText}>
                            {profile?.userCode || "No code"}
                          </Text>
                          <Pressable style={styles.copyButton} onPress={copyUserCode}>
                            <Text style={styles.copyButtonText}>Copy</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.profileCard}>
                        <Text style={styles.subheading}>Change name</Text>

                        <Text style={styles.inputLabel}>Name</Text>
                        <TextInput
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Enter your name"
                            style={styles.input}
                            placeholderTextColor="#6B7280"
                        />

                        <Pressable
                            style={[styles.primary, profileSaving && styles.disabledBtn]}
                            onPress={saveProfileName}
                            disabled={profileSaving}
                        >
                          <Text style={styles.btnText}>
                            {profileSaving ? "Saving..." : "Save name"}
                          </Text>
                        </Pressable>
                      </View>

                      <View style={styles.profileCard}>
                        <Text style={styles.subheading}>Change password</Text>

                        <Text style={styles.inputLabel}>Current password</Text>
                        <TextInput
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            placeholder="Enter current password"
                            secureTextEntry
                            style={styles.input}
                            placeholderTextColor="#6B7280"
                        />

                        <Text style={styles.inputLabel}>New password</Text>
                        <TextInput
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="Enter new password"
                            secureTextEntry
                            style={styles.input}
                            placeholderTextColor="#6B7280"
                        />

                        <Text style={styles.inputLabel}>Confirm new password</Text>
                        <TextInput
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Confirm new password"
                            secureTextEntry
                            style={styles.input}
                            placeholderTextColor="#6B7280"
                        />

                        <Pressable
                            style={[styles.primary, passwordSaving && styles.disabledBtn]}
                            onPress={changePassword}
                            disabled={passwordSaving}
                        >
                          <Text style={styles.btnText}>
                            {passwordSaving ? "Saving..." : "Update password"}
                          </Text>
                        </Pressable>
                      </View>

                      <Pressable
                          style={styles.secondary}
                          onPress={() => setShowProfileModal(false)}
                      >
                        <Text style={styles.secondaryText}>Close</Text>
                      </Pressable>
                    </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#B0B7BC",
  },

  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0B162A",
  },

  card: {
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 16,
    gap: 10,
  },

  warningCard: {
    backgroundColor: "#FFF4E5",
    borderWidth: 1,
    borderColor: "#F59E0B",
    padding: 14,
    borderRadius: 16,
    gap: 8,
  },

  warningTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#92400E",
  },

  warningMedName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  warningDose: {
    fontSize: 13,
    color: "#4B5563",
  },

  warningTime: {
    fontSize: 14,
    color: "#7C2D12",
    fontWeight: "700",
  },

  warningButton: {
    backgroundColor: "#F59E0B",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  warningButtonText: {
    color: "#FFF",
    fontWeight: "900",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0B162A",
  },

  subheading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  smallLabel: {
    fontSize: 13,
    color: "#4B5563",
  },

  time: {
    fontSize: 26,
    color: "#0076B6",
    fontWeight: "900",
  },

  medBlock: {
    gap: 2,
  },

  medName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  medDose: {
    fontSize: 13,
    color: "#4B5563",
  },

  emptyText: {
    fontSize: 15,
    color: "#4B5563",
  },

  primary: {
    backgroundColor: "#0076B6",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  secondary: {
    backgroundColor: "#E5E7EB",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  missedButton: {
    backgroundColor: "#B91C1C",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  missedButtonText: {
    color: "#FFF",
    fontWeight: "900",
  },

  disabledBtn: {
    opacity: 0.7,
  },

  btnText: {
    color: "#FFF",
    fontWeight: "900",
  },

  secondaryText: {
    color: "#111827",
    fontWeight: "800",
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 16,
  },

  modal: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    gap: 12,
    maxHeight: "90%",
  },

  profileModal: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    maxHeight: "92%",
    overflow: "hidden",
  },

  profileScrollContent: {
    padding: 16,
    gap: 14,
  },

  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#0076B6",
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxOn: {
    backgroundColor: "#0076B6",
  },

  checkboxText: {
    color: "#FFF",
    fontWeight: "900",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },

  missedSummary: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },

  missedSummaryText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "700",
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

  selectedTimeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    textAlign: "center",
  },

  profileButton: {
    backgroundColor: "#0B162A",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  profileButtonText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 16,
  },

  profileCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },

  profileLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4B5563",
  },

  profileValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  userCodeText: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#0076B6",
  },

  copyButton: {
    backgroundColor: "#E0F2FE",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  copyButtonText: {
    color: "#0369A1",
    fontWeight: "800",
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4B5563",
    marginTop: 2,
  },

  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
});
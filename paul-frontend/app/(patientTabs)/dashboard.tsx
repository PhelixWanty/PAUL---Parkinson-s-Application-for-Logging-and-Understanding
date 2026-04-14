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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch } from "../../lib/api";

/* ---------- TYPES ---------- */

type Medication = {
  id?: string;
  _id?: string;
  userId?: string;
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
  takenTime?: string;
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
  id: string;
  name: string;
  email: string;
  userCode: string;
  role?: string | null;
};

type ConnectionType = "CAREGIVER" | "CLINICIAN";
type ConnectionStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";

type PatientConnection = {
  id: string;
  patientId: string;
  patientName?: string;
  patientEmail?: string;
  patientCode?: string;

  connectedUserId: string;
  connectedUserName?: string;
  connectedUserEmail?: string;
  connectedUserCode?: string;

  connectionType: ConnectionType;
  status: ConnectionStatus;

  patientAccepted: boolean;
  connectedUserAccepted: boolean;
  fullyAccepted: boolean;

  requestedByUserId?: string;
  requestedAt?: string;
  patientAcceptedAt?: string;
  connectedUserAcceptedAt?: string;
  finalizedAt?: string;
};

type SelectedDoseInfo = {
  medicationName: string;
  scheduledTime: string;
  displayTime: string;
  dosage?: string;
};

/* ---------- MOTIVATIONAL MESSAGE HELPER ---------- */

const MESSAGES = [
  "Nice job staying on schedule today.",
  "Great work — every on-time dose helps build consistency.",
  "You’re doing a good job taking care of yourself.",
  "Another step completed. Keep going.",
];

function randomMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

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

function findPatientPendingApproval(list: PatientConnection[]) {
  return (
      list.find(
          (connection) =>
              connection.status === "PENDING" && !connection.patientAccepted
      ) ?? null
  );
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
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
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
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
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

  const [selectedDoseInfo, setSelectedDoseInfo] = useState<SelectedDoseInfo | null>(null);

  const [connections, setConnections] = useState<PatientConnection[]>([]);
  const [showPendingConnectionPopup, setShowPendingConnectionPopup] = useState(false);
  const [pendingConnectionToReview, setPendingConnectionToReview] =
      useState<PatientConnection | null>(null);
  const [respondingConnectionId, setRespondingConnectionId] = useState<string | null>(null);

  const [encouragement, setEncouragement] = useState("");
  const [showEncouragement, setShowEncouragement] = useState(false);

  async function loadData() {
    try {
      const currentUser: UserProfile = await apiFetch("/api/users/me");
      const currentUserId = currentUser?.id;

      const medsData = await apiFetch("/api/medications");
      const allMeds = Array.isArray(medsData) ? medsData : [];

      const medList = currentUserId
          ? allMeds.filter((med) => med.userId === currentUserId)
          : [];

      setMeds(medList);

      const logsMap: Record<string, MedicationLog[]> = {};

      for (const m of medList) {
        const id = getId(m);
        if (!id) continue;

        try {
          const logs = await apiFetch(`/api/medication-logs/medication/${id}`);
          logsMap[id] = Array.isArray(logs) ? logs : [];
        } catch (err) {
          console.log("Failed to load logs for medication:", id, err);
          logsMap[id] = [];
        }
      }

      setLogsByMed(logsMap);
    } catch (e: any) {
      setMeds([]);
      setLogsByMed({});
      Alert.alert("Error", e?.message ?? "Failed to load dashboard data.");
    }
  }

  async function loadConnections() {
    try {
      const data = await apiFetch("/api/connections/me");
      const list = Array.isArray(data) ? data : [];

      setConnections(list);

      const pending = findPatientPendingApproval(list);
      setPendingConnectionToReview(pending);
      setShowPendingConnectionPopup(!!pending);
    } catch (e: any) {
      console.log("Failed to load connections", e);
      setConnections([]);
      setPendingConnectionToReview(null);
      setShowPendingConnectionPopup(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([loadData(), loadConnections()]);
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

  function openTakeDoseModal(
      medicationIds: string[],
      scheduledTime?: string,
      doseInfo?: SelectedDoseInfo
  ) {
    setSelectedIds(medicationIds);
    setTakenEntry(getInitialTakenEntry(scheduledTime));
    setSelectedDoseInfo(doseInfo ?? null);
    setShowLogModal(true);
  }

  function openMissedDoseModal(
      medicationIds: string[],
      scheduledTime?: string,
      doseInfo?: SelectedDoseInfo
  ) {
    setSelectedIds(medicationIds);
    setTakenEntry(getInitialTakenEntry(scheduledTime));
    setSelectedDoseInfo(doseInfo ?? null);
    setShowMissedModal(true);
  }

  async function saveDoseLogs(
      status: "TAKEN" | "MISSED" | "SKIPPED",
      scheduledTime?: string,
      useTakenTime = false
  ) {
    if (!selectedIds.length) return;

    try {
      setSaving(true);

      for (const medicationId of selectedIds) {
        const payload: any = {
          medicationId,
          scheduledTime,
          status,
        };

        if (useTakenTime) {
          const time24 = entryTo24Hour(takenEntry);
          if (!time24) {
            Alert.alert("Invalid time", "Please choose a valid time.");
            return;
          }
          payload.takenTime = time24;
        }

        await apiFetch("/api/medication-logs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setShowLogModal(false);
      setShowMissedModal(false);
      setSelectedIds([]);
      setSelectedDoseInfo(null);

      if (status === "TAKEN") {
        setEncouragement(randomMessage());
        setShowEncouragement(true);
      }

      await loadData();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save medication log.");
    } finally {
      setSaving(false);
    }
  }

  async function respondToConnection(connectionId: string, accept: boolean) {
    try {
      setRespondingConnectionId(connectionId);

      await apiFetch(`/api/connections/${connectionId}/respond`, {
        method: "POST",
        body: JSON.stringify({ accept }),
      });

      await loadConnections();

      setShowPendingConnectionPopup(false);
      setPendingConnectionToReview(null);

      Alert.alert(
          accept ? "Connection accepted" : "Connection denied",
          accept
              ? "The connection was accepted successfully."
              : "The connection request was denied."
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to respond to connection.");
    } finally {
      setRespondingConnectionId(null);
    }
  }

  useEffect(() => {
    loadData();
    loadConnections();
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

          {showEncouragement ? (
              <View style={styles.encouragementCard}>
                <Text style={styles.encouragementTitle}>Nice work</Text>
                <Text style={styles.encouragementText}>{encouragement}</Text>

                <Pressable
                    style={styles.encouragementButton}
                    onPress={() => setShowEncouragement(false)}
                >
                  <Text style={styles.encouragementButtonText}>Dismiss</Text>
                </Pressable>
              </View>
          ) : null}

          {firstMissedDose ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>You might have missed this dose</Text>

                <Text style={styles.warningMedName}>
                  {firstMissedDose.medicationName}
                </Text>

                {!!firstMissedDose.dosage && (
                    <Text style={styles.warningDose}>{firstMissedDose.dosage}</Text>
                )}

                <Text style={styles.warningTime}>
                  Scheduled for {firstMissedDose.displayTime}
                </Text>

                <Pressable
                    style={styles.warningButton}
                    onPress={() =>
                        openMissedDoseModal(
                            [firstMissedDose.medicationId],
                            firstMissedDose.scheduledTime,
                            {
                              medicationName: firstMissedDose.medicationName,
                              scheduledTime: firstMissedDose.scheduledTime,
                              displayTime: firstMissedDose.displayTime,
                              dosage: firstMissedDose.dosage,
                            }
                        )
                    }
                >
                  <Text style={styles.warningButtonText}>Review this dose</Text>
                </Pressable>
              </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Next Dose</Text>

            {!nextGroup ? (
                <Text style={styles.emptyText}>No more upcoming doses today.</Text>
            ) : (
                <>
                  <Text style={styles.time}>{nextGroup.displayTime}</Text>

                  {nextGroup.medications.map((dose) => (
                      <View key={getDoseKey(dose)} style={styles.medBlock}>
                        <Text style={styles.medName}>{dose.medicationName}</Text>
                        {!!dose.dosage && <Text style={styles.medDose}>{dose.dosage}</Text>}
                      </View>
                  ))}

                  <Pressable
                      style={styles.primary}
                      onPress={() =>
                          openTakeDoseModal(
                              nextGroup.medications.map((d) => d.medicationId),
                              nextGroup.scheduledTime,
                              {
                                medicationName:
                                    nextGroup.medications.length === 1
                                        ? nextGroup.medications[0].medicationName
                                        : `${nextGroup.medications.length} medications`,
                                scheduledTime: nextGroup.scheduledTime,
                                displayTime: nextGroup.displayTime,
                                dosage:
                                    nextGroup.medications.length === 1
                                        ? nextGroup.medications[0].dosage
                                        : undefined,
                              }
                          )
                      }
                  >
                    <Text style={styles.btnText}>Mark this dose as taken</Text>
                  </Pressable>
                </>
            )}
          </View>
        </ScrollView>

        <Modal visible={showLogModal} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <Text style={styles.sectionTitle}>Mark Dose as Taken</Text>

              {selectedDoseInfo ? (
                  <View style={styles.reviewDoseCard}>
                    <Text style={styles.reviewDoseName}>
                      {selectedDoseInfo.medicationName}
                    </Text>

                    {!!selectedDoseInfo.dosage && (
                        <Text style={styles.reviewDoseDosage}>
                          {selectedDoseInfo.dosage}
                        </Text>
                    )}

                    <Text style={styles.reviewDoseTime}>
                      Scheduled time: {selectedDoseInfo.displayTime}
                    </Text>
                  </View>
              ) : null}

              <Text style={styles.helperText}>
                Choose the time you took this medication.
              </Text>

              <View style={styles.wheelsRow}>
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
                    label="AM/PM"
                    data={PERIODS}
                    selectedValue={takenEntry.period}
                    onValueChange={(value) =>
                        setTakenEntry((prev) => ({ ...prev, period: value }))
                    }
                />
              </View>

              <Text style={styles.selectedTimeText}>
                Selected time: {takenEntry.hour}:{takenEntry.minute} {takenEntry.period}
              </Text>

              <View style={styles.missedDoseButtonRow}>
                <Pressable
                    style={[
                      styles.missedDoseHalfButton,
                      styles.secondary,
                      saving && styles.disabledBtn,
                    ]}
                    onPress={() => {
                      setShowLogModal(false);
                      setSelectedDoseInfo(null);
                    }}
                    disabled={saving}
                >
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>

                <Pressable
                    style={[
                      styles.missedDoseHalfButton,
                      styles.primaryActionButton,
                      saving && styles.disabledBtn,
                    ]}
                    onPress={() =>
                        saveDoseLogs("TAKEN", selectedDoseInfo?.scheduledTime, true)
                    }
                    disabled={saving}
                >
                  <Text style={styles.btnText}>{saving ? "Saving..." : "Mark Taken"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showMissedModal} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <Text style={styles.sectionTitle}>Review Missed Dose</Text>

              {selectedDoseInfo ? (
                  <View style={styles.reviewDoseCard}>
                    <Text style={styles.reviewDoseName}>
                      {selectedDoseInfo.medicationName}
                    </Text>

                    {!!selectedDoseInfo.dosage && (
                        <Text style={styles.reviewDoseDosage}>
                          {selectedDoseInfo.dosage}
                        </Text>
                    )}

                    <Text style={styles.reviewDoseTime}>
                      Scheduled time: {selectedDoseInfo.displayTime}
                    </Text>
                  </View>
              ) : null}

              <Text style={styles.helperText}>
                You can mark it as taken now or confirm it was missed.
              </Text>

              <View style={styles.wheelsRow}>
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
                    label="AM/PM"
                    data={PERIODS}
                    selectedValue={takenEntry.period}
                    onValueChange={(value) =>
                        setTakenEntry((prev) => ({ ...prev, period: value }))
                    }
                />
              </View>

              <Text style={styles.selectedTimeText}>
                Taken time: {takenEntry.hour}:{takenEntry.minute} {takenEntry.period}
              </Text>

              <View style={styles.missedDoseButtonRow}>
                <Pressable
                    style={[
                      styles.missedDoseHalfButton,
                      styles.secondary,
                      saving && styles.disabledBtn,
                    ]}
                    onPress={() => {
                      setShowMissedModal(false);
                      setSelectedDoseInfo(null);
                    }}
                    disabled={saving}
                >
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>

                <Pressable
                    style={[
                      styles.missedDoseHalfButton,
                      styles.primaryActionButton,
                      saving && styles.disabledBtn,
                    ]}
                    onPress={() =>
                        saveDoseLogs("TAKEN", selectedDoseInfo?.scheduledTime, true)
                    }
                    disabled={saving}
                >
                  <Text style={styles.btnText}>{saving ? "Saving..." : "Mark Taken"}</Text>
                </Pressable>
              </View>

              <Pressable
                  style={[styles.missedButton, saving && styles.disabledBtn]}
                  onPress={() =>
                      saveDoseLogs("MISSED", selectedDoseInfo?.scheduledTime, false)
                  }
                  disabled={saving}
              >
                <Text style={styles.missedButtonText}>
                  {saving ? "Saving..." : "Confirm Missed"}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={showPendingConnectionPopup} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <Text style={styles.sectionTitle}>Connection request</Text>

              {pendingConnectionToReview ? (
                  <>
                    <Text style={styles.helperText}>
                      {pendingConnectionToReview.connectedUserName || "A user"} wants to connect
                      with you.
                    </Text>

                    {!!pendingConnectionToReview.connectedUserEmail && (
                        <Text style={styles.helperText}>
                          {pendingConnectionToReview.connectedUserEmail}
                        </Text>
                    )}

                    <Text style={styles.warningText}>
                      They will not see your information unless you approve the request.
                    </Text>

                    <View style={styles.modalActions}>
                      <Pressable
                          style={[
                            styles.secondary,
                            respondingConnectionId === pendingConnectionToReview.id &&
                            styles.disabledBtn,
                          ]}
                          onPress={() =>
                              respondToConnection(pendingConnectionToReview.id, false)
                          }
                          disabled={respondingConnectionId === pendingConnectionToReview.id}
                      >
                        <Text style={styles.secondaryText}>
                          {respondingConnectionId === pendingConnectionToReview.id
                              ? "Saving..."
                              : "Deny"}
                        </Text>
                      </Pressable>

                      <Pressable
                          style={[
                            styles.primary,
                            respondingConnectionId === pendingConnectionToReview.id &&
                            styles.disabledBtn,
                          ]}
                          onPress={() =>
                              respondToConnection(pendingConnectionToReview.id, true)
                          }
                          disabled={respondingConnectionId === pendingConnectionToReview.id}
                      >
                        <Text style={styles.btnText}>
                          {respondingConnectionId === pendingConnectionToReview.id
                              ? "Saving..."
                              : "Allow"}
                        </Text>
                      </Pressable>
                    </View>
                  </>
              ) : null}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1F2A44",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1F2A44",
    marginBottom: 10,
  },
  helperText: {
    fontSize: 14,
    color: "#60708A",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 15,
    color: "#7B8798",
  },
  time: {
    fontSize: 32,
    fontWeight: "800",
    color: "#3556D8",
    marginBottom: 10,
  },
  medBlock: {
    backgroundColor: "#F7F9FD",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  medName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2A44",
  },
  medDose: {
    fontSize: 14,
    color: "#60708A",
    marginTop: 4,
  },
  primary: {
    backgroundColor: "#3556D8",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryActionButton: {
    backgroundColor: "#3556D8",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondary: {
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  secondaryText: {
    color: "#3556D8",
    fontSize: 15,
    fontWeight: "800",
  },
  disabledBtn: {
    opacity: 0.7,
  },
  warningCard: {
    backgroundColor: "#FFF4E5",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#FFD8A8",
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#8A4B08",
    marginBottom: 8,
  },
  warningMedName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#5F370E",
  },
  warningDose: {
    fontSize: 14,
    color: "#7A4A16",
    marginTop: 4,
  },
  warningTime: {
    fontSize: 14,
    color: "#7A4A16",
    marginTop: 6,
    marginBottom: 12,
  },
  warningButton: {
    backgroundColor: "#F08C00",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  warningButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  encouragementCard: {
    backgroundColor: "#EAFBF0",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#B7E4C7",
  },
  encouragementTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E6F43",
    marginBottom: 6,
  },
  encouragementText: {
    fontSize: 15,
    color: "#2D6A4F",
    marginBottom: 12,
  },
  encouragementButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2D6A4F",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  encouragementButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    justifyContent: "flex-end",
  },
  wheelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
  },
  wheelBlock: {
    flex: 1,
  },
  wheelLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#60708A",
    marginBottom: 8,
    textAlign: "center",
  },
  wheelPickerContainer: {
    backgroundColor: "#F7F9FD",
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  wheelPickerItem: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  wheelPickerItemText: {
    fontSize: 18,
    color: "#8B97A9",
    fontWeight: "600",
    zIndex: 2,
  },
  wheelPickerItemTextSelected: {
    color: "#1F2A44",
    fontWeight: "800",
  },
  wheelPickerSelectionBox: {
    position: "absolute",
    left: 8,
    right: 8,
    borderRadius: 14,
    backgroundColor: "#E8EEFF",
    borderWidth: 1,
    borderColor: "#C8D5FF",
    zIndex: 0,
  },
  selectedTimeText: {
    fontSize: 15,
    color: "#1F2A44",
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  missedDoseButtonRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
  },
  missedDoseHalfButton: {
    flex: 1,
    maxWidth: 160,
  },
  missedButton: {
    marginTop: 14,
    backgroundColor: "#F08C00",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  missedButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  warningText: {
    fontSize: 14,
    color: "#B45309",
    marginTop: 6,
  },
  reviewDoseCard: {
    backgroundColor: "#F7F9FD",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  reviewDoseName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1F2A44",
  },
  reviewDoseDosage: {
    fontSize: 14,
    color: "#60708A",
    marginTop: 4,
  },
  reviewDoseTime: {
    fontSize: 14,
    color: "#3556D8",
    marginTop: 6,
    fontWeight: "700",
  },
});
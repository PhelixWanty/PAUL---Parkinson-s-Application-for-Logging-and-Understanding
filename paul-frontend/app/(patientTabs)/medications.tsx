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

type MedicationLog = {
    id?: string;
    _id?: string;
    medicationId: string;
    scheduledTime?: string;
    status: "TAKEN" | "MISSED" | "SKIPPED";
    timestamp?: string;
    medicationName?: string;
    medicationActive?: boolean;
};

type TimeEntry = {
    id: string;
    hour: string;
    minute: string;
    period: "AM" | "PM";
};

type LogTimeEntry = {
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

function getLogId(log: MedicationLog) {
    return log.id ?? log._id ?? "";
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

function toDisplayDateTime(value?: string) {
    if (!value) return "No time set";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
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

function isoToLogEntry(value?: string): LogTimeEntry {
    if (!value) {
        return { hour: "8", minute: "00", period: "AM" };
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return { hour: "8", minute: "00", period: "AM" };
    }

    let hour = date.getHours();
    const minute = date.getMinutes();
    const period: "AM" | "PM" = hour >= 12 ? "PM" : "AM";

    hour = hour % 12;
    if (hour === 0) hour = 12;

    return {
        hour: String(hour),
        minute: String(minute).padStart(2, "0"),
        period,
    };
}

function logEntryToIso(entry: LogTimeEntry) {
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

    const now = new Date();
    now.setHours(hour, minute, 0, 0);
    return now.toISOString();
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

    const [logsOpen, setLogsOpen] = useState(false);
    const [logsLoading, setLogsLoading] = useState(false);
    const [allLogs, setAllLogs] = useState<MedicationLog[]>([]);

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

    const [editLogOpen, setEditLogOpen] = useState(false);
    const [editLog, setEditLog] = useState<MedicationLog | null>(null);
    const [editLogStatus, setEditLogStatus] =
        useState<"TAKEN" | "MISSED" | "SKIPPED">("TAKEN");
    const [editLogTime, setEditLogTime] = useState<LogTimeEntry>({
        hour: "8",
        minute: "00",
        period: "AM",
    });

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

    async function loadAllMedicationLogs(medicationList?: Medication[]) {
        try {
            setLogsLoading(true);

            const medsToUse = medicationList ?? meds;

            const results = await Promise.all(
                medsToUse.map(async (med) => {
                    const medicationId = getId(med);
                    if (!medicationId) return [];

                    try {
                        const data = await apiFetch(
                            `/api/medication-logs/medication/${medicationId}`
                        );

                        return Array.isArray(data)
                            ? data.map((log) => ({
                                ...log,
                                medicationName: med.name,
                                medicationActive: med.active !== false,
                            }))
                            : [];
                    } catch {
                        return [];
                    }
                })
            );

            const merged = results
                .flat()
                .sort((a, b) => {
                    const aTime = new Date(a.timestamp || 0).getTime();
                    const bTime = new Date(b.timestamp || 0).getTime();
                    return bTime - aTime;
                });

            setAllLogs(merged);
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to load medication logs.");
        } finally {
            setLogsLoading(false);
        }
    }

    async function onRefresh() {
        try {
            setRefreshing(true);

            const data = await apiFetch("/api/medications");
            const medsData = Array.isArray(data) ? data : [];
            setMeds(medsData);

            if (logsOpen) {
                await loadAllMedicationLogs(medsData);
            }
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to refresh medications");
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
            if (logsOpen) await loadAllMedicationLogs();
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
            if (logsOpen) await loadAllMedicationLogs();
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
            if (logsOpen) await loadAllMedicationLogs();
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
            if (logsOpen) await loadAllMedicationLogs();
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
            if (logsOpen) await loadAllMedicationLogs();
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

    async function toggleShowLogs() {
        const next = !logsOpen;
        setLogsOpen(next);

        if (next) {
            await loadAllMedicationLogs();
        }
    }

    function openEditLog(log: MedicationLog) {
        setEditLog(log);
        setEditLogStatus(log.status || "TAKEN");
        setEditLogTime(isoToLogEntry(log.timestamp));
        setEditLogOpen(true);
    }

    function closeEditLog() {
        setEditLogOpen(false);
        setEditLog(null);
        setEditLogStatus("TAKEN");
        setEditLogTime({
            hour: "8",
            minute: "00",
            period: "AM",
        });
    }

    async function saveLogEditConfirmed() {
        if (!editLog) return;

        const logId = getLogId(editLog);
        if (!logId) {
            Alert.alert("Error", "This log has no id.");
            return;
        }

        const isoTime = logEntryToIso(editLogTime);
        if (!isoTime) {
            Alert.alert("Invalid time", "Please select a valid log time.");
            return;
        }

        try {
            setLoading(true);

            await apiFetch(`/api/medication-logs/${logId}`, {
                method: "PUT",
                body: JSON.stringify({
                    status: editLogStatus,
                    timestamp: isoTime,
                    scheduledTime: editLog.scheduledTime,
                }),
            });

            await loadAllMedicationLogs();
            closeEditLog();

            Alert.alert("Saved", "Medication log updated.");
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to update medication log.");
        } finally {
            setLoading(false);
        }
    }

    function confirmSaveLogEdit() {
        Alert.alert(
            "Save medication log update?",
            "There is no judgement if you missed a dose. Please do not change the log because you want us to be proud. Only change it if it reflects what really happened so your historical data is true and can be used to help you understand yourself better.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Yes, Save",
                    onPress: async () => {
                        await saveLogEditConfirmed();
                    },
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

    const medicationNameMap = useMemo(() => {
        const map: Record<string, string> = {};

        for (const med of meds) {
            const id = getId(med);
            if (id) {
                map[id] = med.name || "Unknown medication";
            }
        }

        return map;
    }, [meds]);

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

                <View style={styles.card}>
                    <Pressable
                        onPress={toggleShowLogs}
                        style={({ pressed }) => [
                            styles.secondaryButton,
                            styles.fullWidthButton,
                            pressed && styles.pressed,
                        ]}
                    >
                        <Text style={styles.secondaryButtonText}>
                            {logsOpen ? "Hide All Medication Logs" : "Show All Medication Logs"}
                        </Text>
                    </Pressable>

                    {logsOpen ? (
                        logsLoading ? (
                            <Text style={styles.helperText}>Loading medication logs...</Text>
                        ) : allLogs.length ? (
                            <View style={styles.logsList}>
                                {allLogs.map((log, index) => {
                                    const logId = getLogId(log) || `${log.medicationId}-${index}`;
                                    const medName =
                                        log.medicationName ||
                                        medicationNameMap[log.medicationId] ||
                                        "Unknown medication";

                                    return (
                                        <View key={logId} style={styles.logCard}>
                                            <View style={styles.logTitleRow}>
                                                <Text style={styles.medName}>{medName}</Text>
                                                <Text
                                                    style={[
                                                        styles.logStatusBadge,
                                                        log.medicationActive === false
                                                            ? styles.logStatusInactive
                                                            : styles.logStatusActive,
                                                    ]}
                                                >
                                                    {log.medicationActive === false
                                                        ? "Inactive Med"
                                                        : "Active Med"}
                                                </Text>
                                            </View>

                                            <Text style={styles.medText}>Status: {log.status}</Text>

                                            {log.status === "TAKEN" && log.timestamp ? (
                                                <Text style={styles.medText}>
                                                    Time taken: {toDisplayDateTime(log.timestamp)}
                                                </Text>
                                            ) : null}

                                            {log.scheduledTime ? (
                                                <Text style={styles.medMutedText}>
                                                    Scheduled time: {toStandardTime(log.scheduledTime)}
                                                </Text>
                                            ) : null}

                                            <Pressable
                                                onPress={() => openEditLog(log)}
                                                style={({ pressed }) => [
                                                    styles.primaryButton,
                                                    styles.actionButton,
                                                    pressed && styles.pressed,
                                                ]}
                                            >
                                                <Text style={styles.primaryButtonText}>Edit Log</Text>
                                            </Pressable>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <Text style={styles.emptyText}>No medication logs found yet.</Text>
                        )
                    ) : (
                        <Text style={styles.helperText}>
                            Tap the button to see every logged dose for both active and
                            deactivated medications.
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

            <Modal visible={editLogOpen} animationType="slide" transparent>
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
                            <Text style={styles.sectionTitle}>Edit Medication Log</Text>
                            <Text style={styles.helperText}>
                                Update this log only if it reflects what really happened.
                            </Text>

                            <Text style={styles.label}>Status</Text>
                            <View style={[styles.actionRow, isSmallScreen && styles.actionColumn]}>
                                {(["TAKEN", "MISSED", "SKIPPED"] as const).map((status) => {
                                    const selected = editLogStatus === status;

                                    return (
                                        <Pressable
                                            key={status}
                                            onPress={() => setEditLogStatus(status)}
                                            style={({ pressed }) => [
                                                selected ? styles.primaryButton : styles.secondaryButton,
                                                styles.actionButton,
                                                pressed && styles.pressed,
                                                isSmallScreen && styles.fullWidthButton,
                                            ]}
                                        >
                                            <Text
                                                style={
                                                    selected
                                                        ? styles.primaryButtonText
                                                        : styles.secondaryButtonText
                                                }
                                            >
                                                {status}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Text style={styles.label}>Time</Text>
                            <View style={styles.timePickerCard}>
                                <View style={styles.timeSelectorsRow}>
                                    <WheelPicker
                                        label="Hour"
                                        data={HOURS}
                                        selectedValue={editLogTime.hour}
                                        onValueChange={(value) =>
                                            setEditLogTime((prev) => ({ ...prev, hour: value }))
                                        }
                                    />

                                    <WheelPicker
                                        label="Minute"
                                        data={MINUTES}
                                        selectedValue={editLogTime.minute}
                                        onValueChange={(value) =>
                                            setEditLogTime((prev) => ({ ...prev, minute: value }))
                                        }
                                    />

                                    <WheelPicker
                                        label="AM / PM"
                                        data={PERIODS}
                                        selectedValue={editLogTime.period}
                                        onValueChange={(value) =>
                                            setEditLogTime((prev) => ({
                                                ...prev,
                                                period: value as "AM" | "PM",
                                            }))
                                        }
                                    />
                                </View>
                            </View>

                            <View
                                style={[
                                    styles.actionRow,
                                    styles.modalActionRow,
                                    isSmallScreen && styles.actionColumn,
                                ]}
                            >
                                <Pressable
                                    onPress={closeEditLog}
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
                                    onPress={confirmSaveLogEdit}
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
        paddingBottom: 40,
        gap: 16,
    },
    header: {
        gap: 4,
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: "800",
        color: "#111827",
    },
    helperText: {
        fontSize: 14,
        color: "#4B5563",
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 16,
        gap: 14,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
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
        color: "#111827",
    },
    emptyText: {
        fontSize: 15,
        color: "#6B7280",
        lineHeight: 22,
    },
    medCard: {
        backgroundColor: "#F9FAFB",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        padding: 14,
        gap: 6,
    },
    inactiveMedCard: {
        backgroundColor: "#F3F4F6",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#D1D5DB",
        padding: 14,
        gap: 6,
    },
    medName: {
        fontSize: 18,
        fontWeight: "800",
        color: "#111827",
        flex: 1,
    },
    medText: {
        fontSize: 15,
        color: "#1F2937",
        lineHeight: 21,
    },
    medMutedText: {
        fontSize: 14,
        color: "#6B7280",
        lineHeight: 20,
    },
    actionRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 8,
    },
    actionColumn: {
        flexDirection: "column",
    },
    actionButton: {
        flex: 1,
    },
    primaryButton: {
        backgroundColor: "#2563EB",
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    primaryButtonText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "700",
    },
    secondaryButton: {
        backgroundColor: "#E5E7EB",
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    secondaryButtonText: {
        color: "#111827",
        fontSize: 15,
        fontWeight: "700",
    },
    addButton: {
        minWidth: 150,
    },
    fullWidthButton: {
        width: "100%",
    },
    pressed: {
        opacity: 0.82,
    },
    disabledButton: {
        opacity: 0.55,
    },
    scheduleButton: {
        backgroundColor: "#111827",
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: "center",
    },
    scheduleButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "800",
    },
    inactiveToggle: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    inactiveToggleText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#2563EB",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(17, 24, 39, 0.45)",
        justifyContent: "center",
        padding: 16,
    },
    modalCard: {
        maxHeight: "92%",
        backgroundColor: "#FFFFFF",
        borderRadius: 22,
        overflow: "hidden",
    },
    modalContent: {
        padding: 18,
        gap: 14,
    },
    label: {
        fontSize: 15,
        fontWeight: "700",
        color: "#111827",
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
    timeHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    smallAddTimeButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: "#DBEAFE",
    },
    smallAddTimeButtonText: {
        color: "#1D4ED8",
        fontWeight: "700",
        fontSize: 14,
    },
    timePickerCard: {
        backgroundColor: "#F9FAFB",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 18,
        padding: 14,
        gap: 12,
    },
    timePickerTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    timePickerLabel: {
        fontSize: 15,
        fontWeight: "700",
        color: "#111827",
    },
    removeTimeButton: {
        backgroundColor: "#FEE2E2",
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    removeTimeButtonText: {
        color: "#B91C1C",
        fontWeight: "700",
        fontSize: 13,
    },
    timeSelectorsRow: {
        flexDirection: "row",
        gap: 10,
    },
    wheelBlock: {
        flex: 1,
        gap: 8,
    },
    wheelLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "#374151",
        textAlign: "center",
    },
    wheelPickerContainer: {
        borderRadius: 16,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        overflow: "hidden",
        position: "relative",
    },
    wheelPickerItem: {
        alignItems: "center",
        justifyContent: "center",
    },
    wheelPickerItemText: {
        fontSize: 18,
        color: "#6B7280",
        fontWeight: "500",
    },
    wheelPickerItemTextSelected: {
        color: "#111827",
        fontWeight: "800",
    },
    wheelPickerSelectionBox: {
        position: "absolute",
        left: 8,
        right: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#93C5FD",
        backgroundColor: "rgba(219, 234, 254, 0.45)",
    },
    toggleButton: {
        backgroundColor: "#EEF2FF",
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: "center",
    },
    toggleButtonText: {
        color: "#3730A3",
        fontSize: 15,
        fontWeight: "700",
    },
    modalActionRow: {
        marginTop: 6,
    },
    scheduleCard: {
        backgroundColor: "#F9FAFB",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        padding: 14,
        gap: 10,
    },
    scheduleTime: {
        fontSize: 18,
        fontWeight: "800",
        color: "#111827",
    },
    scheduleMedicationRow: {
        gap: 3,
        paddingTop: 4,
    },
    scheduleMedicationName: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1F2937",
    },
    scheduleMedicationDetails: {
        fontSize: 14,
        color: "#4B5563",
    },
    logsList: {
        gap: 12,
    },
    logCard: {
        backgroundColor: "#F3F4F6",
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: "#D1D5DB",
        gap: 6,
    },
    logTitleRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
    },
    logStatusBadge: {
        fontSize: 12,
        fontWeight: "800",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        overflow: "hidden",
    },
    logStatusActive: {
        backgroundColor: "#DCFCE7",
        color: "#166534",
    },
    logStatusInactive: {
        backgroundColor: "#E5E7EB",
        color: "#374151",
    },
});
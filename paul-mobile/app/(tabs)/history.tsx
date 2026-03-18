import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    StyleSheet,
    RefreshControl,
    Modal,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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

type SymptomFeeling = "GOOD" | "NEUTRAL" | "BAD";

type SymptomLog = {
    id?: string;
    _id?: string;
    userId?: string;
    category?: string;
    symptomName: string;
    severity: number;
    durationMinutes: number;
    note?: string;
    createdAt?: string;
    feeling?: SymptomFeeling;
};

type DayStatus = "ALL_TAKEN" | "SOME_MISSED" | "ALL_MISSED" | "NONE";
type SymptomDayStatus = "MOSTLY_GOOD" | "MOSTLY_NEUTRAL" | "MOSTLY_BAD" | "NONE";

type DaySummary = {
    dateKey: string;
    label: string;

    medication: {
        expected: number;
        taken: number;
        missed: number;
        skipped: number;
        resolved: number;
        status: DayStatus;
        logs: Array<{
            medicationId: string;
            medicationName: string;
            dosage?: string;
            scheduledTime?: string;
            status: MedicationLog["status"];
            timestamp?: string;
        }>;
    };

    symptoms: {
        total: number;
        good: number;
        neutral: number;
        bad: number;
        status: SymptomDayStatus;
        logs: Array<{
            symptomName: string;
            category?: string;
            severity: number;
            durationMinutes: number;
            note?: string;
            feeling?: SymptomFeeling;
            createdAt?: string;
        }>;
    };
};

type DatePickerField = "start" | "end" | null;

type MedicationFilterValue = "__ALL__" | "__NONE__" | string;
type SymptomFilterValue = "__ALL__" | "__NONE__" | string;

/* ---------- HELPERS ---------- */

function getId(m: Medication) {
    return m.id ?? m._id ?? "";
}

function toDateKey(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function parseLocalDate(dateKey: string) {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatLongDate(date: Date) {
    return date.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

function isSameLocalDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function getMonthLabel(baseDate: Date) {
    return baseDate.toLocaleDateString([], {
        month: "long",
        year: "numeric",
    });
}

function getDaysInMonth(baseDate: Date) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    return new Date(year, month + 1, 0).getDate();
}

function getMonthStartOffset(baseDate: Date) {
    const first = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    return first.getDay();
}

function formatTimeLabel(hhmm?: string) {
    if (!hhmm || !hhmm.includes(":")) return "Unknown time";

    const [hStr, mStr] = hhmm.split(":");
    const h = Number(hStr);
    const m = Number(mStr);

    if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;

    const d = new Date();
    d.setHours(h, m, 0, 0);

    return d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
}

function sortByTimestampAsc<T extends { timestamp?: string }>(items: T[]) {
    return [...items].sort((a, b) => {
        const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return at - bt;
    });
}

function sortSymptomsAsc<T extends { createdAt?: string }>(items: T[]) {
    return [...items].sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return at - bt;
    });
}

function formatInputDate(date: Date) {
    return toDateKey(date);
}

function parseInputDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

    const [y, m, d] = value.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);

    if (
        parsed.getFullYear() !== y ||
        parsed.getMonth() !== m - 1 ||
        parsed.getDate() !== d
    ) {
        return null;
    }

    parsed.setHours(0, 0, 0, 0);
    return parsed;
}

function getSelectedMedicationIds(
    meds: Medication[],
    selectedMedicationId: MedicationFilterValue
) {
    if (selectedMedicationId === "__NONE__") return [];

    if (selectedMedicationId === "__ALL__") {
        return meds
            .filter((m) => m.active !== false)
            .map((m) => getId(m))
            .filter(Boolean);
    }

    return [selectedMedicationId];
}

function getSelectedSymptomNames(
    symptomLogs: SymptomLog[],
    selectedSymptomName: SymptomFilterValue
) {
    if (selectedSymptomName === "__NONE__") return [];

    if (selectedSymptomName === "__ALL__") {
        return Array.from(
            new Set(symptomLogs.map((s) => s.symptomName).filter(Boolean))
        );
    }

    return [selectedSymptomName];
}

function buildMedicationStatus(
    expected: number,
    taken: number,
    missed: number,
    skipped: number
): DayStatus {
    const resolved = taken + missed + skipped;
    let status: DayStatus = "NONE";

    if (expected > 0) {
        if (taken >= expected && missed === 0 && skipped === 0) {
            status = "ALL_TAKEN";
        } else if (taken === 0 && missed + skipped >= expected) {
            status = "ALL_MISSED";
        } else if (missed + skipped > 0 || (resolved > 0 && taken < expected)) {
            status = "SOME_MISSED";
        } else if (taken > 0) {
            status = "ALL_TAKEN";
        }
    }

    return status;
}

function buildSymptomStatus(
    good: number,
    neutral: number,
    bad: number
): SymptomDayStatus {
    const total = good + neutral + bad;
    if (total === 0) return "NONE";

    if (good > bad && good >= neutral) return "MOSTLY_GOOD";
    if (bad > good && bad >= neutral) return "MOSTLY_BAD";

    return "MOSTLY_NEUTRAL";
}

function buildDaySummary(
    day: Date,
    meds: Medication[],
    logsByMed: Record<string, MedicationLog[]>,
    allSymptoms: SymptomLog[],
    selectedMedicationId: MedicationFilterValue,
    selectedSymptomName: SymptomFilterValue
): DaySummary {
    const dateKey = toDateKey(day);

    const selectedMedIds = getSelectedMedicationIds(meds, selectedMedicationId);
    const selectedMeds = meds.filter((m) => selectedMedIds.includes(getId(m)));

    let expected = 0;
    let taken = 0;
    let missed = 0;
    let skipped = 0;

    const medicationLogs: DaySummary["medication"]["logs"] = [];

    for (const med of selectedMeds) {
        const medId = getId(med);
        if (!medId) continue;

        const scheduleCount = med.active === false ? 0 : med.times?.length ?? 0;
        expected += scheduleCount;

        const logs = logsByMed[medId] ?? [];

        const logsForDay = logs.filter((log) => {
            if (!log.timestamp) return false;
            return isSameLocalDay(new Date(log.timestamp), day);
        });

        for (const log of logsForDay) {
            if (log.status === "TAKEN") taken += 1;
            if (log.status === "MISSED") missed += 1;
            if (log.status === "SKIPPED") skipped += 1;

            medicationLogs.push({
                medicationId: medId,
                medicationName: med.name,
                dosage: med.dosage,
                scheduledTime: log.scheduledTime,
                status: log.status,
                timestamp: log.timestamp,
            });
        }
    }

    const selectedSymptomNames = getSelectedSymptomNames(
        allSymptoms,
        selectedSymptomName
    );

    const symptomLogsForDay = allSymptoms.filter((log) => {
        if (!log.createdAt) return false;
        if (!selectedSymptomNames.includes(log.symptomName)) return false;
        return isSameLocalDay(new Date(log.createdAt), day);
    });

    let good = 0;
    let neutral = 0;
    let bad = 0;

    const symptomLogs: DaySummary["symptoms"]["logs"] = symptomLogsForDay.map((log) => {
        if (log.feeling === "GOOD") good += 1;
        else if (log.feeling === "BAD") bad += 1;
        else neutral += 1;

        return {
            symptomName: log.symptomName,
            category: log.category,
            severity: log.severity,
            durationMinutes: log.durationMinutes,
            note: log.note,
            feeling: log.feeling,
            createdAt: log.createdAt,
        };
    });

    return {
        dateKey,
        label: dateKey,
        medication: {
            expected,
            taken,
            missed,
            skipped,
            resolved: taken + missed + skipped,
            status: buildMedicationStatus(expected, taken, missed, skipped),
            logs: sortByTimestampAsc(medicationLogs),
        },
        symptoms: {
            total: symptomLogs.length,
            good,
            neutral,
            bad,
            status: buildSymptomStatus(good, neutral, bad),
            logs: sortSymptomsAsc(symptomLogs),
        },
    };
}

function getMedicationStatusColor(status: DayStatus) {
    switch (status) {
        case "ALL_TAKEN":
            return "#16A34A";
        case "SOME_MISSED":
            return "#F59E0B";
        case "ALL_MISSED":
            return "#DC2626";
        default:
            return "#D1D5DB";
    }
}

function getMedicationStatusLabel(status: DayStatus) {
    switch (status) {
        case "ALL_TAKEN":
            return "All taken";
        case "SOME_MISSED":
            return "Some missed";
        case "ALL_MISSED":
            return "All missed";
        default:
            return "No medication data";
    }
}

function getSymptomStatusColor(status: SymptomDayStatus) {
    switch (status) {
        case "MOSTLY_GOOD":
            return "#16A34A";
        case "MOSTLY_NEUTRAL":
            return "#F59E0B";
        case "MOSTLY_BAD":
            return "#DC2626";
        default:
            return "#D1D5DB";
    }
}

function getSymptomStatusLabel(status: SymptomDayStatus) {
    switch (status) {
        case "MOSTLY_GOOD":
            return "Mostly good feelings";
        case "MOSTLY_NEUTRAL":
            return "Mostly neutral or mixed";
        case "MOSTLY_BAD":
            return "Mostly bad feelings";
        default:
            return "No symptom data";
    }
}

function getFeelingBadgeStyle(feeling?: SymptomFeeling) {
    switch (feeling) {
        case "GOOD":
            return styles.feelingGood;
        case "BAD":
            return styles.feelingBad;
        default:
            return styles.feelingNeutral;
    }
}

/* ---------- COMPONENT ---------- */

export default function MedicationHistoryScreen() {
    const [meds, setMeds] = useState<Medication[]>([]);
    const [logsByMed, setLogsByMed] = useState<Record<string, MedicationLog[]>>(
        {}
    );
    const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const [selectedMedicationId, setSelectedMedicationId] =
        useState<MedicationFilterValue>("__ALL__");
    const [selectedSymptomName, setSelectedSymptomName] =
        useState<SymptomFilterValue>("__ALL__");

    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    const [selectedDay, setSelectedDay] = useState<DaySummary | null>(null);
    const [showSummary, setShowSummary] = useState(false);
    const [showLegendModal, setShowLegendModal] = useState(false);

    const [startDateInput, setStartDateInput] = useState(() => {
        const start = new Date();
        start.setDate(start.getDate() - 13);
        start.setHours(0, 0, 0, 0);
        return formatInputDate(start);
    });

    const [endDateInput, setEndDateInput] = useState(() => {
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        return formatInputDate(end);
    });

    const [datePickerField, setDatePickerField] = useState<DatePickerField>(null);
    const [datePickerMonth, setDatePickerMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    async function loadData() {
        try {
            const [medsData, symptomsData] = await Promise.all([
                apiFetch("/api/medications"),
                apiFetch("/api/symptoms"),
            ]);

            const medList = Array.isArray(medsData) ? medsData : [];
            setMeds(medList);

            const nextLogsMap: Record<string, MedicationLog[]> = {};

            for (const med of medList) {
                const medId = getId(med);
                if (!medId) continue;

                try {
                    const logs = await apiFetch(`/api/medication-logs/medication/${medId}`);
                    nextLogsMap[medId] = Array.isArray(logs) ? logs : [];
                } catch {
                    nextLogsMap[medId] = [];
                }
            }

            setLogsByMed(nextLogsMap);
            setSymptomLogs(Array.isArray(symptomsData) ? symptomsData : []);
        } catch (e: any) {
            Alert.alert(
                "Error",
                e?.message ?? "Failed to load medication and symptom history."
            );
        }
    }

    async function onRefresh() {
        setRefreshing(true);
        try {
            await loadData();
        } finally {
            setRefreshing(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    const selectedMedicationName = useMemo(() => {
        if (selectedMedicationId === "__ALL__") return "All medications";
        if (selectedMedicationId === "__NONE__") return "No medications";
        const found = meds.find((m) => getId(m) === selectedMedicationId);
        return found?.name ?? "Medication";
    }, [meds, selectedMedicationId]);

    const parsedStartDate = useMemo(
        () => parseInputDate(startDateInput),
        [startDateInput]
    );

    const parsedEndDate = useMemo(() => parseInputDate(endDateInput), [endDateInput]);

    const dateRangeError = useMemo(() => {
        if (!parsedStartDate || !parsedEndDate) {
            return "Please select valid start and end dates.";
        }

        if (parsedStartDate.getTime() > parsedEndDate.getTime()) {
            return "Start date must be before or equal to end date.";
        }

        return "";
    }, [parsedStartDate, parsedEndDate]);

    const symptomsInRange = useMemo(() => {
        if (!parsedStartDate || !parsedEndDate) return [];

        const start = new Date(parsedStartDate);
        const end = new Date(parsedEndDate);
        end.setHours(23, 59, 59, 999);

        return symptomLogs.filter((log) => {
            if (!log.createdAt) return false;
            const created = new Date(log.createdAt).getTime();
            return created >= start.getTime() && created <= end.getTime();
        });
    }, [symptomLogs, parsedStartDate, parsedEndDate]);

    const availableSymptomNames = useMemo(() => {
        return Array.from(
            new Set(symptomsInRange.map((s) => s.symptomName).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b));
    }, [symptomsInRange]);

    useEffect(() => {
        if (
            selectedSymptomName !== "__ALL__" &&
            selectedSymptomName !== "__NONE__" &&
            !availableSymptomNames.includes(selectedSymptomName)
        ) {
            setSelectedSymptomName("__ALL__");
        }
    }, [availableSymptomNames, selectedSymptomName]);

    const selectedSymptomLabel = useMemo(() => {
        if (selectedSymptomName === "__ALL__") return "All symptoms";
        if (selectedSymptomName === "__NONE__") return "No symptoms";
        return selectedSymptomName;
    }, [selectedSymptomName]);

    const rangedDays = useMemo(() => {
        if (!parsedStartDate || !parsedEndDate) return [];
        if (parsedStartDate.getTime() > parsedEndDate.getTime()) return [];

        const dates: Date[] = [];
        const cursor = new Date(parsedStartDate);
        const last = new Date(parsedEndDate);

        cursor.setHours(0, 0, 0, 0);
        last.setHours(0, 0, 0, 0);

        while (cursor.getTime() <= last.getTime()) {
            dates.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }

        return dates.map((day) =>
            buildDaySummary(
                day,
                meds,
                logsByMed,
                symptomLogs,
                selectedMedicationId,
                selectedSymptomName
            )
        );
    }, [
        parsedStartDate,
        parsedEndDate,
        meds,
        logsByMed,
        symptomLogs,
        selectedMedicationId,
        selectedSymptomName,
    ]);

    const medicationTotals = useMemo(() => {
        return rangedDays.reduce(
            (acc, day) => {
                acc.expected += day.medication.expected;
                acc.taken += day.medication.taken;
                acc.missed += day.medication.missed;
                acc.skipped += day.medication.skipped;

                if (day.medication.status === "ALL_TAKEN") acc.allTakenDays += 1;
                if (day.medication.status === "SOME_MISSED") acc.someMissedDays += 1;
                if (day.medication.status === "ALL_MISSED") acc.allMissedDays += 1;
                if (day.medication.status === "NONE") acc.noDataDays += 1;

                return acc;
            },
            {
                expected: 0,
                taken: 0,
                missed: 0,
                skipped: 0,
                allTakenDays: 0,
                someMissedDays: 0,
                allMissedDays: 0,
                noDataDays: 0,
            }
        );
    }, [rangedDays]);

    const symptomTotals = useMemo(() => {
        return rangedDays.reduce(
            (acc, day) => {
                acc.total += day.symptoms.total;
                acc.good += day.symptoms.good;
                acc.neutral += day.symptoms.neutral;
                acc.bad += day.symptoms.bad;

                if (day.symptoms.status === "MOSTLY_GOOD") acc.goodDays += 1;
                if (day.symptoms.status === "MOSTLY_NEUTRAL") acc.neutralDays += 1;
                if (day.symptoms.status === "MOSTLY_BAD") acc.badDays += 1;
                if (day.symptoms.status === "NONE") acc.noDataDays += 1;

                return acc;
            },
            {
                total: 0,
                good: 0,
                neutral: 0,
                bad: 0,
                goodDays: 0,
                neutralDays: 0,
                badDays: 0,
                noDataDays: 0,
            }
        );
    }, [rangedDays]);

    const monthDays = useMemo(() => {
        const daysInMonth = getDaysInMonth(calendarMonth);
        const list: DaySummary[] = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const day = new Date(
                calendarMonth.getFullYear(),
                calendarMonth.getMonth(),
                d
            );
            list.push(
                buildDaySummary(
                    day,
                    meds,
                    logsByMed,
                    symptomLogs,
                    selectedMedicationId,
                    selectedSymptomName
                )
            );
        }

        return list;
    }, [
        calendarMonth,
        meds,
        logsByMed,
        symptomLogs,
        selectedMedicationId,
        selectedSymptomName,
    ]);

    const monthOffset = useMemo(
        () => getMonthStartOffset(calendarMonth),
        [calendarMonth]
    );

    const pickerMonthDays = useMemo(() => {
        const daysInMonth = getDaysInMonth(datePickerMonth);
        return Array.from({ length: daysInMonth }, (_, index) => {
            const dayNumber = index + 1;
            return new Date(
                datePickerMonth.getFullYear(),
                datePickerMonth.getMonth(),
                dayNumber
            );
        });
    }, [datePickerMonth]);

    const pickerMonthOffset = useMemo(
        () => getMonthStartOffset(datePickerMonth),
        [datePickerMonth]
    );

    function goPrevMonth() {
        setCalendarMonth(
            (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
        );
    }

    function goNextMonth() {
        setCalendarMonth(
            (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
        );
    }

    function setLast7Days() {
        const end = new Date();
        end.setHours(0, 0, 0, 0);

        const start = new Date(end);
        start.setDate(end.getDate() - 6);

        setStartDateInput(formatInputDate(start));
        setEndDateInput(formatInputDate(end));
    }

    function setLast14Days() {
        const end = new Date();
        end.setHours(0, 0, 0, 0);

        const start = new Date(end);
        start.setDate(end.getDate() - 13);

        setStartDateInput(formatInputDate(start));
        setEndDateInput(formatInputDate(end));
    }

    function setLast30Days() {
        const end = new Date();
        end.setHours(0, 0, 0, 0);

        const start = new Date(end);
        start.setDate(end.getDate() - 29);

        setStartDateInput(formatInputDate(start));
        setEndDateInput(formatInputDate(end));
    }

    function openDatePicker(field: DatePickerField) {
        setDatePickerField(field);

        const currentValue =
            field === "start" ? parseInputDate(startDateInput) : parseInputDate(endDateInput);

        const base = currentValue ?? new Date();
        setDatePickerMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    }

    function closeDatePicker() {
        setDatePickerField(null);
    }

    function goPrevPickerMonth() {
        setDatePickerMonth(
            (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
        );
    }

    function goNextPickerMonth() {
        setDatePickerMonth(
            (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
        );
    }

    function onSelectPickerDate(date: Date) {
        const formatted = formatInputDate(date);

        if (datePickerField === "start") {
            setStartDateInput(formatted);
        } else if (datePickerField === "end") {
            setEndDateInput(formatted);
        }

        closeDatePicker();
    }

    const selectedPickerDate =
        datePickerField === "start"
            ? parseInputDate(startDateInput)
            : datePickerField === "end"
                ? parseInputDate(endDateInput)
                : null;

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                <Text style={styles.title}>History</Text>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Medication filter</Text>
                    <Text style={styles.helperText}>
                        View all medications, no medications, or choose one medication.
                    </Text>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterRow}
                    >
                        <Pressable
                            style={[
                                styles.filterChip,
                                selectedMedicationId === "__ALL__" && styles.filterChipActive,
                            ]}
                            onPress={() => setSelectedMedicationId("__ALL__")}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    selectedMedicationId === "__ALL__" && styles.filterChipTextActive,
                                ]}
                            >
                                All medications
                            </Text>
                        </Pressable>

                        <Pressable
                            style={[
                                styles.filterChip,
                                selectedMedicationId === "__NONE__" && styles.filterChipActive,
                            ]}
                            onPress={() => setSelectedMedicationId("__NONE__")}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    selectedMedicationId === "__NONE__" && styles.filterChipTextActive,
                                ]}
                            >
                                No medications
                            </Text>
                        </Pressable>

                        {meds
                            .filter((m) => getId(m))
                            .map((med) => {
                                const id = getId(med);
                                const active = selectedMedicationId === id;

                                return (
                                    <Pressable
                                        key={id}
                                        style={[styles.filterChip, active && styles.filterChipActive]}
                                        onPress={() => setSelectedMedicationId(id)}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                active && styles.filterChipTextActive,
                                            ]}
                                        >
                                            {med.name}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                    </ScrollView>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Symptom filter</Text>
                    <Text style={styles.helperText}>
                        View all symptoms, no symptoms, or one symptom logged in the selected
                        date range.
                    </Text>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterRow}
                    >
                        <Pressable
                            style={[
                                styles.filterChip,
                                selectedSymptomName === "__ALL__" && styles.filterChipActive,
                            ]}
                            onPress={() => setSelectedSymptomName("__ALL__")}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    selectedSymptomName === "__ALL__" && styles.filterChipTextActive,
                                ]}
                            >
                                All symptoms
                            </Text>
                        </Pressable>

                        <Pressable
                            style={[
                                styles.filterChip,
                                selectedSymptomName === "__NONE__" && styles.filterChipActive,
                            ]}
                            onPress={() => setSelectedSymptomName("__NONE__")}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    selectedSymptomName === "__NONE__" && styles.filterChipTextActive,
                                ]}
                            >
                                No symptoms
                            </Text>
                        </Pressable>

                        {availableSymptomNames.map((name) => {
                            const active = selectedSymptomName === name;

                            return (
                                <Pressable
                                    key={name}
                                    style={[styles.filterChip, active && styles.filterChipActive]}
                                    onPress={() => setSelectedSymptomName(name)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipText,
                                            active && styles.filterChipTextActive,
                                        ]}
                                    >
                                        {name}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Date range</Text>
                    <Text style={styles.helperText}>
                        Tap a date field to choose a date from a calendar.
                    </Text>

                    <View style={styles.dateInputsRow}>
                        <View style={styles.dateInputBlock}>
                            <Text style={styles.dateLabel}>Start date</Text>
                            <Pressable
                                style={styles.datePickerButton}
                                onPress={() => openDatePicker("start")}
                            >
                                <Text style={styles.datePickerButtonText}>{startDateInput}</Text>
                                <Ionicons
                                    name="calendar-outline"
                                    size={18}
                                    color="#0B162A"
                                    style={styles.datePickerIcon}
                                />
                            </Pressable>
                        </View>

                        <View style={styles.dateInputBlock}>
                            <Text style={styles.dateLabel}>End date</Text>
                            <Pressable
                                style={styles.datePickerButton}
                                onPress={() => openDatePicker("end")}
                            >
                                <Text style={styles.datePickerButtonText}>{endDateInput}</Text>
                                <Ionicons
                                    name="calendar-outline"
                                    size={18}
                                    color="#0B162A"
                                    style={styles.datePickerIcon}
                                />
                            </Pressable>
                        </View>
                    </View>

                    <View style={styles.quickRangeRow}>
                        <Pressable style={styles.quickRangeButton} onPress={setLast7Days}>
                            <Text style={styles.quickRangeButtonText}>Last 7 days</Text>
                        </Pressable>

                        <Pressable style={styles.quickRangeButton} onPress={setLast14Days}>
                            <Text style={styles.quickRangeButtonText}>Last 14 days</Text>
                        </Pressable>

                        <Pressable style={styles.quickRangeButton} onPress={setLast30Days}>
                            <Text style={styles.quickRangeButtonText}>Last 30 days</Text>
                        </Pressable>
                    </View>

                    {dateRangeError ? (
                        <Text style={styles.errorText}>{dateRangeError}</Text>
                    ) : (
                        <Text style={styles.validRangeText}>
                            Showing {selectedMedicationName.toLowerCase()} and{" "}
                            {selectedSymptomLabel.toLowerCase()} from {startDateInput} to{" "}
                            {endDateInput}
                        </Text>
                    )}
                </View>

                <View style={styles.card}>
                    <View style={styles.calendarHeaderRow}>
                        <View style={styles.calendarHeaderTextWrap}>
                            <Text style={styles.sectionTitle}>Calendar view</Text>
                            <Text style={styles.helperText}>
                                Top half = medications · Bottom half = symptoms
                            </Text>
                            <Text style={styles.helperText}>
                                {selectedMedicationName} · {selectedSymptomLabel}
                            </Text>
                        </View>

                        <Pressable
                            style={styles.infoButton}
                            onPress={() => setShowLegendModal(true)}
                        >
                            <Text style={styles.infoButtonText}>ⓘ</Text>
                        </Pressable>
                    </View>

                    <View style={styles.monthNav}>
                        <Pressable style={styles.monthButton} onPress={goPrevMonth}>
                            <Text style={styles.monthButtonText}>‹</Text>
                        </Pressable>

                        <Text style={styles.monthLabel}>{getMonthLabel(calendarMonth)}</Text>

                        <Pressable style={styles.monthButton} onPress={goNextMonth}>
                            <Text style={styles.monthButtonText}>›</Text>
                        </Pressable>
                    </View>

                    <View style={styles.weekdayRow}>
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                            <Text key={day} style={styles.weekdayText}>
                                {day}
                            </Text>
                        ))}
                    </View>

                    <View style={styles.calendarGrid}>
                        {Array.from({ length: monthOffset }).map((_, i) => (
                            <View key={`blank-${i}`} style={styles.calendarCellBlank} />
                        ))}

                        {monthDays.map((day) => {
                            const date = parseLocalDate(day.dateKey);
                            const isToday = isSameLocalDay(date, new Date());

                            return (
                                <Pressable
                                    key={day.dateKey}
                                    style={[styles.calendarCellWrap, isToday && styles.todayCell]}
                                    onPress={() => setSelectedDay(day)}
                                >
                                    <View style={styles.calendarDateBadge}>
                                        <Text style={styles.calendarDayNumber}>{date.getDate()}</Text>
                                    </View>

                                    <View
                                        style={[
                                            styles.calendarHalf,
                                            styles.calendarTopHalf,
                                            {
                                                backgroundColor: getMedicationStatusColor(
                                                    day.medication.status
                                                ),
                                            },
                                        ]}
                                    />

                                    <View
                                        style={[
                                            styles.calendarHalf,
                                            styles.calendarBottomHalf,
                                            {
                                                backgroundColor: getSymptomStatusColor(day.symptoms.status),
                                            },
                                        ]}
                                    />
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.card}>
                    <Pressable
                        style={styles.dropdownHeader}
                        onPress={() => setShowSummary((prev) => !prev)}
                    >
                        <Text style={styles.sectionTitle}>Summary</Text>
                        <Text style={styles.dropdownIcon}>{showSummary ? "▲" : "▼"}</Text>
                    </Pressable>

                    <Text style={styles.helperText}>
                        Summary for {selectedMedicationName.toLowerCase()} and{" "}
                        {selectedSymptomLabel.toLowerCase()} in the selected date range.
                    </Text>

                    {showSummary ? (
                        dateRangeError ? (
                            <Text style={styles.emptyText}>Fix the date range to view summary.</Text>
                        ) : (
                            <>
                                <Text style={styles.summaryBlockTitle}>Medication summary</Text>

                                <View style={styles.summaryStatsRow}>
                                    <View style={styles.summaryStat}>
                                        <Text style={styles.summaryStatNumber}>
                                            {medicationTotals.taken}
                                        </Text>
                                        <Text style={styles.summaryStatLabel}>Taken</Text>
                                    </View>

                                    <View style={styles.summaryStat}>
                                        <Text style={styles.summaryStatNumber}>
                                            {medicationTotals.missed}
                                        </Text>
                                        <Text style={styles.summaryStatLabel}>Missed</Text>
                                    </View>

                                    <View style={styles.summaryStat}>
                                        <Text style={styles.summaryStatNumber}>
                                            {medicationTotals.skipped}
                                        </Text>
                                        <Text style={styles.summaryStatLabel}>Skipped</Text>
                                    </View>

                                    <View style={styles.summaryStat}>
                                        <Text style={styles.summaryStatNumber}>
                                            {medicationTotals.expected}
                                        </Text>
                                        <Text style={styles.summaryStatLabel}>Expected</Text>
                                    </View>
                                </View>

                                <View style={styles.summaryDetailsCard}>
                                    <Text style={styles.summaryDetailText}>
                                        All taken days: {medicationTotals.allTakenDays}
                                    </Text>
                                    <Text style={styles.summaryDetailText}>
                                        Some missed days: {medicationTotals.someMissedDays}
                                    </Text>
                                    <Text style={styles.summaryDetailText}>
                                        All missed days: {medicationTotals.allMissedDays}
                                    </Text>
                                    <Text style={styles.summaryDetailText}>
                                        No medication data days: {medicationTotals.noDataDays}
                                    </Text>
                                </View>

                                <Text style={styles.summaryBlockTitle}>Symptom summary</Text>

                                <View style={styles.summaryStatsRow}>
                                    <View style={styles.summaryStat}>
                                        <Text style={styles.summaryStatNumber}>{symptomTotals.good}</Text>
                                        <Text style={styles.summaryStatLabel}>Good</Text>
                                    </View>

                                    <View style={styles.summaryStat}>
                                        <Text style={styles.summaryStatNumber}>
                                            {symptomTotals.neutral}
                                        </Text>
                                        <Text style={styles.summaryStatLabel}>Neutral</Text>
                                    </View>

                                    <View style={styles.summaryStat}>
                                        <Text style={styles.summaryStatNumber}>{symptomTotals.bad}</Text>
                                        <Text style={styles.summaryStatLabel}>Bad</Text>
                                    </View>

                                    <View style={styles.summaryStat}>
                                        <Text style={styles.summaryStatNumber}>
                                            {symptomTotals.total}
                                        </Text>
                                        <Text style={styles.summaryStatLabel}>Logged</Text>
                                    </View>
                                </View>

                                <View style={styles.summaryDetailsCard}>
                                    <Text style={styles.summaryDetailText}>
                                        Mostly good feeling days: {symptomTotals.goodDays}
                                    </Text>
                                    <Text style={styles.summaryDetailText}>
                                        Mixed or neutral days: {symptomTotals.neutralDays}
                                    </Text>
                                    <Text style={styles.summaryDetailText}>
                                        Mostly bad feeling days: {symptomTotals.badDays}
                                    </Text>
                                    <Text style={styles.summaryDetailText}>
                                        No symptom data days: {symptomTotals.noDataDays}
                                    </Text>
                                </View>
                            </>
                        )
                    ) : null}
                </View>
            </ScrollView>

            <Modal visible={showLegendModal} transparent animationType="fade">
                <View style={styles.overlay}>
                    <View style={styles.legendModal}>
                        <View style={styles.dropdownHeader}>
                            <Text style={styles.sectionTitle}>Color key</Text>
                            <Pressable onPress={() => setShowLegendModal(false)}>
                                <Text style={styles.closeText}>Close</Text>
                            </Pressable>
                        </View>

                        <View style={styles.legendSection}>
                            <Text style={styles.legendSectionTitle}>Top half: Medication</Text>

                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: "#16A34A" }]} />
                                <Text style={styles.legendText}>All taken</Text>
                            </View>

                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
                                <Text style={styles.legendText}>Some missed</Text>
                            </View>

                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: "#DC2626" }]} />
                                <Text style={styles.legendText}>All missed</Text>
                            </View>

                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: "#D1D5DB" }]} />
                                <Text style={styles.legendText}>No medication data</Text>
                            </View>
                        </View>

                        <View style={styles.legendSection}>
                            <Text style={styles.legendSectionTitle}>Bottom half: Symptoms</Text>

                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: "#16A34A" }]} />
                                <Text style={styles.legendText}>Mostly good feelings</Text>
                            </View>

                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
                                <Text style={styles.legendText}>Mostly neutral or mixed</Text>
                            </View>

                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: "#DC2626" }]} />
                                <Text style={styles.legendText}>Mostly bad feelings</Text>
                            </View>

                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: "#D1D5DB" }]} />
                                <Text style={styles.legendText}>No symptom data</Text>
                            </View>
                        </View>

                        <Pressable
                            style={styles.secondary}
                            onPress={() => setShowLegendModal(false)}
                        >
                            <Text style={styles.secondaryText}>Done</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!selectedDay} transparent animationType="fade">
                <View style={styles.overlay}>
                    <View style={styles.modal}>
                        {selectedDay ? (
                            <>
                                <Text style={styles.sectionTitle}>
                                    {formatLongDate(parseLocalDate(selectedDay.dateKey))}
                                </Text>

                                <View style={styles.dayStatusBox}>
                                    <Text style={styles.dayStatusTitle}>Medication</Text>
                                    <Text style={styles.dayStatusText}>
                                        {getMedicationStatusLabel(selectedDay.medication.status)}
                                    </Text>
                                    <Text style={styles.dayStatusText}>
                                        Expected: {selectedDay.medication.expected} · Taken:{" "}
                                        {selectedDay.medication.taken} · Missed:{" "}
                                        {selectedDay.medication.missed} · Skipped:{" "}
                                        {selectedDay.medication.skipped}
                                    </Text>
                                </View>

                                <View style={styles.dayStatusBox}>
                                    <Text style={styles.dayStatusTitle}>Symptoms</Text>
                                    <Text style={styles.dayStatusText}>
                                        {getSymptomStatusLabel(selectedDay.symptoms.status)}
                                    </Text>
                                    <Text style={styles.dayStatusText}>
                                        Good: {selectedDay.symptoms.good} · Neutral:{" "}
                                        {selectedDay.symptoms.neutral} · Bad: {selectedDay.symptoms.bad}
                                    </Text>
                                </View>

                                <Text style={styles.subheading}>Medication logs for this day</Text>

                                {selectedDay.medication.logs.length === 0 ? (
                                    <Text style={styles.emptyText}>
                                        No medication logs for this day.
                                    </Text>
                                ) : (
                                    <ScrollView style={{ maxHeight: 220 }}>
                                        {selectedDay.medication.logs.map((item, index) => (
                                            <View
                                                key={`${item.medicationId}-${item.timestamp}-${index}`}
                                                style={styles.logRow}
                                            >
                                                <View style={styles.logTopRow}>
                                                    <Text style={styles.logMedicationName}>
                                                        {item.medicationName}
                                                    </Text>
                                                    <View
                                                        style={[
                                                            styles.statusBadge,
                                                            item.status === "TAKEN" && styles.statusTaken,
                                                            item.status === "MISSED" && styles.statusMissed,
                                                            item.status === "SKIPPED" && styles.statusSkipped,
                                                        ]}
                                                    >
                                                        <Text style={styles.statusBadgeText}>{item.status}</Text>
                                                    </View>
                                                </View>

                                                {item.dosage ? (
                                                    <Text style={styles.logDose}>{item.dosage}</Text>
                                                ) : null}

                                                <Text style={styles.logMeta}>
                                                    Scheduled: {formatTimeLabel(item.scheduledTime)}
                                                </Text>

                                                <Text style={styles.logMeta}>
                                                    Logged:{" "}
                                                    {item.timestamp
                                                        ? new Date(item.timestamp).toLocaleTimeString([], {
                                                            hour: "numeric",
                                                            minute: "2-digit",
                                                        })
                                                        : "Unknown"}
                                                </Text>
                                            </View>
                                        ))}
                                    </ScrollView>
                                )}

                                <Text style={styles.subheading}>Symptom logs for this day</Text>

                                {selectedDay.symptoms.logs.length === 0 ? (
                                    <Text style={styles.emptyText}>No symptom logs for this day.</Text>
                                ) : (
                                    <ScrollView style={{ maxHeight: 220 }}>
                                        {selectedDay.symptoms.logs.map((item, index) => (
                                            <View
                                                key={`${item.symptomName}-${item.createdAt}-${index}`}
                                                style={styles.logRow}
                                            >
                                                <View style={styles.logTopRow}>
                                                    <Text style={styles.logMedicationName}>
                                                        {item.symptomName}
                                                    </Text>
                                                    <View
                                                        style={[
                                                            styles.statusBadge,
                                                            getFeelingBadgeStyle(item.feeling),
                                                        ]}
                                                    >
                                                        <Text style={styles.statusBadgeText}>
                                                            {item.feeling ?? "NEUTRAL"}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <Text style={styles.logMeta}>
                                                    Category: {item.category ?? "Unknown"}
                                                </Text>
                                                <Text style={styles.logMeta}>
                                                    Severity: {item.severity}/10
                                                </Text>
                                                <Text style={styles.logMeta}>
                                                    Duration: {item.durationMinutes} min
                                                </Text>
                                                <Text style={styles.logMeta}>
                                                    Logged:{" "}
                                                    {item.createdAt
                                                        ? new Date(item.createdAt).toLocaleTimeString([], {
                                                            hour: "numeric",
                                                            minute: "2-digit",
                                                        })
                                                        : "Unknown"}
                                                </Text>

                                                {item.note ? (
                                                    <Text style={styles.logMeta}>Note: {item.note}</Text>
                                                ) : null}
                                            </View>
                                        ))}
                                    </ScrollView>
                                )}

                                <Pressable
                                    style={styles.secondary}
                                    onPress={() => setSelectedDay(null)}
                                >
                                    <Text style={styles.secondaryText}>Close</Text>
                                </Pressable>
                            </>
                        ) : null}
                    </View>
                </View>
            </Modal>

            <Modal visible={!!datePickerField} transparent animationType="fade">
                <View style={styles.overlay}>
                    <View style={styles.datePickerModal}>
                        <View style={styles.dropdownHeader}>
                            <Text style={styles.sectionTitle}>
                                {datePickerField === "start" ? "Select start date" : "Select end date"}
                            </Text>
                            <Pressable onPress={closeDatePicker}>
                                <Text style={styles.closeText}>Close</Text>
                            </Pressable>
                        </View>

                        <View style={styles.monthNav}>
                            <Pressable style={styles.monthButton} onPress={goPrevPickerMonth}>
                                <Text style={styles.monthButtonText}>‹</Text>
                            </Pressable>

                            <Text style={styles.monthLabel}>{getMonthLabel(datePickerMonth)}</Text>

                            <Pressable style={styles.monthButton} onPress={goNextPickerMonth}>
                                <Text style={styles.monthButtonText}>›</Text>
                            </Pressable>
                        </View>

                        <View style={styles.weekdayRow}>
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                                <Text key={day} style={styles.weekdayText}>
                                    {day}
                                </Text>
                            ))}
                        </View>

                        <View style={styles.calendarGrid}>
                            {Array.from({ length: pickerMonthOffset }).map((_, i) => (
                                <View key={`picker-blank-${i}`} style={styles.calendarCellBlank} />
                            ))}

                            {pickerMonthDays.map((date) => {
                                const isSelected =
                                    selectedPickerDate && isSameLocalDay(date, selectedPickerDate);
                                const isToday = isSameLocalDay(date, new Date());

                                return (
                                    <Pressable
                                        key={toDateKey(date)}
                                        style={[
                                            styles.pickerDayCell,
                                            isToday && styles.pickerTodayCell,
                                            isSelected && styles.pickerSelectedCell,
                                        ]}
                                        onPress={() => onSelectPickerDate(date)}
                                    >
                                        <Text
                                            style={[
                                                styles.pickerDayText,
                                                isSelected && styles.pickerDayTextSelected,
                                            ]}
                                        >
                                            {date.getDate()}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <View style={styles.pickerFooter}>
                            <Text style={styles.helperText}>
                                Selected:{" "}
                                {selectedPickerDate
                                    ? formatLongDate(selectedPickerDate)
                                    : "No date selected"}
                            </Text>
                        </View>
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
    },

    title: {
        fontSize: 28,
        fontWeight: "900",
        color: "#0B162A",
    },

    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 14,
        gap: 12,
    },

    sectionTitle: {
        fontSize: 20,
        fontWeight: "900",
        color: "#0B162A",
    },

    helperText: {
        fontSize: 14,
        color: "#4B5563",
    },

    filterRow: {
        gap: 10,
        paddingRight: 10,
    },

    filterChip: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: "#E5E7EB",
    },

    filterChipActive: {
        backgroundColor: "#0076B6",
    },

    filterChipText: {
        color: "#111827",
        fontWeight: "800",
    },

    filterChipTextActive: {
        color: "#FFFFFF",
    },

    dateInputsRow: {
        flexDirection: "row",
        gap: 10,
    },

    dateInputBlock: {
        flex: 1,
        gap: 6,
    },

    dateLabel: {
        fontSize: 14,
        fontWeight: "800",
        color: "#0B162A",
    },

    datePickerButton: {
        backgroundColor: "#F9FAFB",
        borderWidth: 1,
        borderColor: "#D1D5DB",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    datePickerButtonText: {
        fontSize: 15,
        color: "#111827",
        fontWeight: "700",
    },

    datePickerIcon: {
        marginLeft: 8,
    },

    quickRangeRow: {
        flexDirection: "row",
        gap: 8,
        flexWrap: "wrap",
    },

    quickRangeButton: {
        backgroundColor: "#E5E7EB",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
    },

    quickRangeButtonText: {
        color: "#111827",
        fontWeight: "800",
        fontSize: 13,
    },

    errorText: {
        fontSize: 14,
        color: "#B91C1C",
        fontWeight: "700",
    },

    validRangeText: {
        fontSize: 14,
        color: "#374151",
        fontWeight: "700",
    },

    calendarHeaderRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
    },

    calendarHeaderTextWrap: {
        flex: 1,
        gap: 2,
    },

    infoButton: {
        width: 34,
        height: 34,
        borderRadius: 999,
        backgroundColor: "#E5E7EB",
        alignItems: "center",
        justifyContent: "center",
    },

    infoButtonText: {
        fontSize: 18,
        fontWeight: "900",
        color: "#0B162A",
    },

    monthNav: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    monthButton: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: "#E5E7EB",
        alignItems: "center",
        justifyContent: "center",
    },

    monthButtonText: {
        fontSize: 24,
        fontWeight: "900",
        color: "#0B162A",
        lineHeight: 24,
    },

    monthLabel: {
        fontSize: 18,
        fontWeight: "900",
        color: "#0B162A",
    },

    weekdayRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },

    weekdayText: {
        width: "13.5%",
        textAlign: "center",
        fontSize: 12,
        fontWeight: "800",
        color: "#4B5563",
    },

    calendarGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },

    calendarCellBlank: {
        width: "13.5%",
        aspectRatio: 1,
    },

    calendarCellWrap: {
        width: "13.5%",
        aspectRatio: 1,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#E5E7EB",
        position: "relative",
    },

    todayCell: {
        borderWidth: 3,
        borderColor: "#0B162A",
    },

    calendarDateBadge: {
        position: "absolute",
        top: 4,
        left: 6,
        zIndex: 2,
    },

    calendarDayNumber: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "900",
        textShadowColor: "rgba(0,0,0,0.35)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },

    calendarHalf: {
        flex: 1,
    },

    calendarTopHalf: {
        borderBottomWidth: 2,
        borderBottomColor: "#FFFFFF",
    },

    calendarBottomHalf: {},

    dropdownHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },

    dropdownIcon: {
        fontSize: 18,
        fontWeight: "900",
        color: "#0B162A",
    },

    summaryBlockTitle: {
        fontSize: 16,
        fontWeight: "900",
        color: "#0B162A",
        marginTop: 4,
    },

    summaryStatsRow: {
        flexDirection: "row",
        gap: 10,
        flexWrap: "wrap",
    },

    summaryStat: {
        flexGrow: 1,
        minWidth: "22%",
        backgroundColor: "#F9FAFB",
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 12,
        alignItems: "center",
    },

    summaryStatNumber: {
        fontSize: 20,
        fontWeight: "900",
        color: "#0B162A",
    },

    summaryStatLabel: {
        fontSize: 13,
        color: "#4B5563",
        fontWeight: "700",
    },

    summaryDetailsCard: {
        backgroundColor: "#F9FAFB",
        borderRadius: 12,
        padding: 12,
        gap: 8,
    },

    summaryDetailText: {
        fontSize: 14,
        color: "#374151",
        fontWeight: "700",
    },

    emptyText: {
        fontSize: 15,
        color: "#4B5563",
    },

    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        padding: 16,
    },

    modal: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        gap: 12,
        maxHeight: "90%",
    },

    datePickerModal: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        gap: 12,
    },

    legendModal: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        gap: 14,
    },

    closeText: {
        fontSize: 15,
        fontWeight: "800",
        color: "#0076B6",
    },

    legendSection: {
        gap: 8,
    },

    legendSectionTitle: {
        fontSize: 15,
        fontWeight: "900",
        color: "#0B162A",
    },

    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 999,
    },

    legendText: {
        fontSize: 14,
        color: "#374151",
        fontWeight: "700",
    },

    pickerDayCell: {
        width: "13.5%",
        aspectRatio: 1,
        borderRadius: 12,
        backgroundColor: "#F3F4F6",
        alignItems: "center",
        justifyContent: "center",
    },

    pickerTodayCell: {
        borderWidth: 2,
        borderColor: "#0B162A",
    },

    pickerSelectedCell: {
        backgroundColor: "#0076B6",
    },

    pickerDayText: {
        fontSize: 15,
        fontWeight: "900",
        color: "#111827",
    },

    pickerDayTextSelected: {
        color: "#FFFFFF",
    },

    pickerFooter: {
        marginTop: 4,
    },

    dayStatusBox: {
        backgroundColor: "#F9FAFB",
        padding: 12,
        borderRadius: 12,
        gap: 4,
    },

    dayStatusTitle: {
        fontSize: 16,
        fontWeight: "900",
        color: "#0B162A",
    },

    dayStatusText: {
        fontSize: 14,
        color: "#374151",
        fontWeight: "700",
    },

    subheading: {
        fontSize: 16,
        fontWeight: "800",
        color: "#111827",
    },

    logRow: {
        backgroundColor: "#F9FAFB",
        borderRadius: 12,
        padding: 12,
        gap: 4,
        marginBottom: 10,
    },

    logTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 10,
        alignItems: "center",
    },

    logMedicationName: {
        fontSize: 15,
        fontWeight: "900",
        color: "#111827",
        flex: 1,
    },

    logDose: {
        fontSize: 13,
        color: "#4B5563",
    },

    logMeta: {
        fontSize: 13,
        color: "#374151",
        fontWeight: "700",
    },

    statusBadge: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
    },

    statusTaken: {
        backgroundColor: "#16A34A",
    },

    statusMissed: {
        backgroundColor: "#DC2626",
    },

    statusSkipped: {
        backgroundColor: "#6B7280",
    },

    feelingGood: {
        backgroundColor: "#16A34A",
    },

    feelingNeutral: {
        backgroundColor: "#F59E0B",
    },

    feelingBad: {
        backgroundColor: "#DC2626",
    },

    statusBadgeText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "900",
    },

    secondary: {
        backgroundColor: "#E5E7EB",
        padding: 14,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },

    secondaryText: {
        color: "#111827",
        fontWeight: "800",
    },
});
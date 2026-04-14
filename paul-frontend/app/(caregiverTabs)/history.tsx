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

type PatientProfile = {
    id: string;
    name: string;
    email?: string;
    userCode?: string;
};

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

export default function CaregiverHistoryScreen() {
    const [patient, setPatient] = useState<PatientProfile | null>(null);
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
            const [patientData, medsData, symptomsData] = await Promise.all([
                apiFetch("/api/caregiver/patient"),
                apiFetch("/api/caregiver/patient/medications"),
                apiFetch("/api/caregiver/patient/symptoms").catch(() => []),
            ]);

            setPatient(patientData ?? null);

            const medList = Array.isArray(medsData) ? medsData : [];
            setMeds(medList);

            const nextLogsMap: Record<string, MedicationLog[]> = {};

            if (patientData?.id) {
                for (const med of medList) {
                    const medId = getId(med);
                    if (!medId) continue;

                    try {
                        const logs = await apiFetch(
                            `/api/medication-logs/patient/${patientData.id}/medication/${medId}`
                        );
                        nextLogsMap[medId] = Array.isArray(logs) ? logs : [];
                    } catch {
                        nextLogsMap[medId] = [];
                    }
                }
            }

            setLogsByMed(nextLogsMap);
            setSymptomLogs(Array.isArray(symptomsData) ? symptomsData : []);
        } catch (e: any) {
            Alert.alert(
                "Error",
                e?.message ?? "Failed to load caregiver patient history."
            );
            setPatient(null);
            setMeds([]);
            setLogsByMed({});
            setSymptomLogs([]);
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

    useEffect(() => {
        if (selectedDay) {
            setShowSummary(true);
        }
    }, [selectedDay]);

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
                    <Text style={styles.sectionTitle}>Connected patient</Text>
                    {patient ? (
                        <>
                            <Text style={styles.patientName}>{patient.name}</Text>
                            {!!patient.email && (
                                <Text style={styles.helperText}>{patient.email}</Text>
                            )}
                        </>
                    ) : (
                        <Text style={styles.helperText}>No connected patient found.</Text>
                    )}
                </View>

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
                    <View style={styles.summaryHeaderRow}>
                        <Text style={styles.sectionTitle}>Summary</Text>
                    </View>

                    <View style={styles.summaryGrid}>
                        <View style={styles.summaryStat}>
                            <Text style={styles.summaryValue}>{medicationTotals.taken}</Text>
                            <Text style={styles.summaryLabel}>Taken</Text>
                        </View>
                        <View style={styles.summaryStat}>
                            <Text style={styles.summaryValue}>{medicationTotals.missed}</Text>
                            <Text style={styles.summaryLabel}>Missed</Text>
                        </View>
                        <View style={styles.summaryStat}>
                            <Text style={styles.summaryValue}>{medicationTotals.skipped}</Text>
                            <Text style={styles.summaryLabel}>Skipped</Text>
                        </View>
                        <View style={styles.summaryStat}>
                            <Text style={styles.summaryValue}>{symptomTotals.total}</Text>
                            <Text style={styles.summaryLabel}>Symptoms</Text>
                        </View>
                    </View>
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
                                                backgroundColor: getSymptomStatusColor(
                                                    day.symptoms.status
                                                ),
                                            },
                                        ]}
                                    />
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>

            <Modal visible={!!datePickerField} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Select {datePickerField === "start" ? "start" : "end"} date
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
                                const selected =
                                    selectedPickerDate && isSameLocalDay(date, selectedPickerDate);

                                return (
                                    <Pressable
                                        key={date.toISOString()}
                                        style={[
                                            styles.pickerDayButton,
                                            selected && styles.pickerDayButtonActive,
                                        ]}
                                        onPress={() => onSelectPickerDate(date)}
                                    >
                                        <Text
                                            style={[
                                                styles.pickerDayText,
                                                selected && styles.pickerDayTextActive,
                                            ]}
                                        >
                                            {date.getDate()}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showLegendModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Calendar legend</Text>
                            <Pressable onPress={() => setShowLegendModal(false)}>
                                <Text style={styles.closeText}>Close</Text>
                            </Pressable>
                        </View>

                        <Text style={styles.legendText}>Top half = medication status</Text>
                        <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: "#16A34A" }]} />
                            <Text style={styles.legendText}>All taken</Text>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
                            <Text style={styles.legendText}>Some missed</Text>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: "#DC2626" }]} />
                            <Text style={styles.legendText}>All missed</Text>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: "#D1D5DB" }]} />
                            <Text style={styles.legendText}>No medication data</Text>
                        </View>

                        <Text style={[styles.legendText, { marginTop: 14 }]}>
                            Bottom half = symptom status
                        </Text>
                        <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: "#16A34A" }]} />
                            <Text style={styles.legendText}>Mostly good feelings</Text>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
                            <Text style={styles.legendText}>Mostly neutral or mixed</Text>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: "#DC2626" }]} />
                            <Text style={styles.legendText}>Mostly bad feelings</Text>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: "#D1D5DB" }]} />
                            <Text style={styles.legendText}>No symptom data</Text>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showSummary} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.summaryModal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {selectedDay
                                    ? formatLongDate(parseLocalDate(selectedDay.dateKey))
                                    : "Day summary"}
                            </Text>
                            <Pressable
                                onPress={() => {
                                    setShowSummary(false);
                                    setSelectedDay(null);
                                }}
                            >
                                <Text style={styles.closeText}>Close</Text>
                            </Pressable>
                        </View>

                        <ScrollView contentContainerStyle={styles.summaryContent}>
                            {selectedDay && (
                                <>
                                    <View style={styles.summarySection}>
                                        <Text style={styles.summarySectionTitle}>Medication</Text>
                                        <Text style={styles.helperText}>
                                            {getMedicationStatusLabel(selectedDay.medication.status)}
                                        </Text>
                                        <Text style={styles.helperText}>
                                            Expected: {selectedDay.medication.expected} · Taken:{" "}
                                            {selectedDay.medication.taken} · Missed:{" "}
                                            {selectedDay.medication.missed} · Skipped:{" "}
                                            {selectedDay.medication.skipped}
                                        </Text>

                                        {selectedDay.medication.logs.length === 0 ? (
                                            <Text style={styles.emptyText}>No medication logs for this day.</Text>
                                        ) : (
                                            <View style={styles.detailList}>
                                                {selectedDay.medication.logs.map((log, index) => (
                                                    <View key={`${log.medicationId}-${index}`} style={styles.detailCard}>
                                                        <Text style={styles.detailTitle}>
                                                            {log.medicationName}
                                                        </Text>
                                                        {!!log.dosage && (
                                                            <Text style={styles.detailText}>{log.dosage}</Text>
                                                        )}
                                                        <Text style={styles.detailText}>
                                                            {log.status} · {formatTimeLabel(log.scheduledTime)}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.summarySection}>
                                        <Text style={styles.summarySectionTitle}>Symptoms</Text>
                                        <Text style={styles.helperText}>
                                            {getSymptomStatusLabel(selectedDay.symptoms.status)}
                                        </Text>
                                        <Text style={styles.helperText}>
                                            Total: {selectedDay.symptoms.total} · Good:{" "}
                                            {selectedDay.symptoms.good} · Neutral:{" "}
                                            {selectedDay.symptoms.neutral} · Bad:{" "}
                                            {selectedDay.symptoms.bad}
                                        </Text>

                                        {selectedDay.symptoms.logs.length === 0 ? (
                                            <Text style={styles.emptyText}>No symptom logs for this day.</Text>
                                        ) : (
                                            <View style={styles.detailList}>
                                                {selectedDay.symptoms.logs.map((log, index) => (
                                                    <View key={`${log.symptomName}-${index}`} style={styles.detailCard}>
                                                        <View style={styles.detailRowBetween}>
                                                            <Text style={styles.detailTitle}>
                                                                {log.symptomName}
                                                            </Text>
                                                            <View
                                                                style={[
                                                                    styles.feelingBadge,
                                                                    getFeelingBadgeStyle(log.feeling),
                                                                ]}
                                                            >
                                                                <Text style={styles.feelingBadgeText}>
                                                                    {log.feeling ?? "NEUTRAL"}
                                                                </Text>
                                                            </View>
                                                        </View>

                                                        {!!log.category && (
                                                            <Text style={styles.detailText}>
                                                                Category: {log.category}
                                                            </Text>
                                                        )}
                                                        <Text style={styles.detailText}>
                                                            Severity: {log.severity}/10
                                                        </Text>
                                                        <Text style={styles.detailText}>
                                                            Duration: {log.durationMinutes} min
                                                        </Text>
                                                        {!!log.note && (
                                                            <Text style={styles.detailText}>
                                                                Note: {log.note}
                                                            </Text>
                                                        )}
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#B0B7BC" },
    container: { padding: 16, gap: 16, paddingBottom: 32 },

    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#1F2937",
    },

    card: {
        backgroundColor: "#F8FAFC",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#D7DEE3",
        gap: 12,
    },

    sectionTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#1F2937",
    },

    patientName: {
        fontSize: 18,
        fontWeight: "700",
        color: "#1F2937",
    },

    helperText: {
        color: "#64748B",
        fontSize: 14,
        lineHeight: 20,
    },

    filterRow: {
        flexDirection: "row",
        gap: 10,
        paddingRight: 8,
    },

    filterChip: {
        backgroundColor: "#E2E8F0",
        borderRadius: 999,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },

    filterChipActive: {
        backgroundColor: "#2563EB",
    },

    filterChipText: {
        color: "#1F2937",
        fontWeight: "700",
        fontSize: 13,
    },

    filterChipTextActive: {
        color: "#FFFFFF",
    },

    dateInputsRow: {
        flexDirection: "row",
        gap: 12,
    },

    dateInputBlock: {
        flex: 1,
        gap: 6,
    },

    dateLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "#475569",
    },

    datePickerButton: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    datePickerButtonText: {
        color: "#111827",
        fontSize: 14,
        fontWeight: "600",
    },

    datePickerIcon: {
        marginLeft: 8,
    },

    quickRangeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },

    quickRangeButton: {
        backgroundColor: "#E2E8F0",
        borderRadius: 999,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },

    quickRangeButtonText: {
        color: "#0F172A",
        fontSize: 13,
        fontWeight: "700",
    },

    errorText: {
        color: "#B91C1C",
        fontSize: 13,
        fontWeight: "700",
    },

    validRangeText: {
        color: "#475569",
        fontSize: 13,
        fontWeight: "700",
    },

    summaryHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    summaryGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },

    summaryStat: {
        flexBasis: "47%",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 14,
        padding: 14,
        alignItems: "center",
    },

    summaryValue: {
        fontSize: 24,
        fontWeight: "800",
        color: "#0F172A",
    },

    summaryLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: "#475569",
    },

    calendarHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
    },

    calendarHeaderTextWrap: {
        flex: 1,
        gap: 2,
    },

    infoButton: {
        width: 32,
        height: 32,
        borderRadius: 999,
        backgroundColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
    },

    infoButtonText: {
        fontSize: 16,
        fontWeight: "800",
        color: "#0F172A",
    },

    monthNav: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },

    monthButton: {
        width: 36,
        height: 36,
        borderRadius: 999,
        backgroundColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
    },

    monthButtonText: {
        fontSize: 22,
        fontWeight: "700",
        color: "#0F172A",
        marginTop: -2,
    },

    monthLabel: {
        fontSize: 18,
        fontWeight: "800",
        color: "#1F2937",
    },

    weekdayRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },

    weekdayText: {
        width: `${100 / 7}%`,
        textAlign: "center",
        fontSize: 12,
        fontWeight: "700",
        color: "#64748B",
    },

    calendarGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
    },

    calendarCellBlank: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        padding: 4,
    },

    calendarCellWrap: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        padding: 4,
    },

    todayCell: {
        transform: [{ scale: 1.02 }],
    },

    calendarDateBadge: {
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 2,
    },

    calendarDayNumber: {
        fontSize: 12,
        fontWeight: "800",
        color: "#0F172A",
    },

    calendarHalf: {
        flex: 1,
        borderRadius: 8,
    },

    calendarTopHalf: {
        marginBottom: 2,
    },

    calendarBottomHalf: {
        marginTop: 2,
    },

    pickerDayButton: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        padding: 4,
        alignItems: "center",
        justifyContent: "center",
    },

    pickerDayButtonActive: {
        backgroundColor: "#2563EB",
        borderRadius: 12,
    },

    pickerDayText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#0F172A",
    },

    pickerDayTextActive: {
        color: "#FFFFFF",
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.45)",
        justifyContent: "center",
        padding: 16,
    },

    modalCard: {
        backgroundColor: "#F8FAFC",
        borderRadius: 18,
        padding: 16,
        maxHeight: "80%",
    },

    summaryModal: {
        backgroundColor: "#F8FAFC",
        borderRadius: 18,
        padding: 16,
        maxHeight: "85%",
    },

    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },

    modalTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#1F2937",
        flex: 1,
        paddingRight: 12,
    },

    closeText: {
        color: "#2563EB",
        fontSize: 14,
        fontWeight: "800",
    },

    legendRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 8,
    },

    legendDot: {
        width: 14,
        height: 14,
        borderRadius: 999,
    },

    legendText: {
        color: "#334155",
        fontSize: 14,
    },

    summaryContent: {
        gap: 16,
        paddingBottom: 8,
    },

    summarySection: {
        gap: 8,
    },

    summarySectionTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#1F2937",
    },

    detailList: {
        gap: 10,
    },

    detailCard: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 14,
        padding: 12,
        gap: 4,
    },

    detailTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: "#1F2937",
    },

    detailText: {
        fontSize: 14,
        color: "#475569",
    },

    detailRowBetween: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },

    feelingBadge: {
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 10,
    },

    feelingGood: {
        backgroundColor: "#DCFCE7",
    },

    feelingNeutral: {
        backgroundColor: "#FEF3C7",
    },

    feelingBad: {
        backgroundColor: "#FEE2E2",
    },

    feelingBadgeText: {
        fontSize: 11,
        fontWeight: "800",
        color: "#0F172A",
    },

    emptyText: {
        color: "#64748B",
        fontSize: 14,
    },
});
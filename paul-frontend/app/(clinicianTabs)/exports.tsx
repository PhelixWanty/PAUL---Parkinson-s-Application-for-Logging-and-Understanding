import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Alert,
    ScrollView,
    TextInput,
    RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { apiFetch } from "../../lib/api";

type ExportType = "medications" | "symptoms" | "both";

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
    status: "TAKEN" | "MISSED" | "SKIPPED" | string;
    timestamp?: string;
    note?: string;
};

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
    feeling?: "GOOD" | "NEUTRAL" | "BAD";
};

type FlattenedMedicationLog = {
    medicationName: string;
    dosage?: string;
    scheduledTime?: string;
    status?: string;
    timestamp?: string;
    note?: string;
};

function getId(m: Medication) {
    return m.id ?? m._id ?? "";
}

function formatInputDate(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
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

function toDateKey(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function formatTimeLabel(hhmm?: string) {
    if (!hhmm || !hhmm.includes(":")) return hhmm || "Unknown time";

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

function formatDateTime(value?: string) {
    if (!value) return "Unknown time";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function csvEscape(value: string | number | undefined | null) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function safeFileName(value: string) {
    return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function escapeHtml(value: string | number | undefined | null) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function buildBar(value: number, total: number, color: string) {
    const safeTotal = total > 0 ? total : 1;
    const percent = Math.max(6, Math.round((value / safeTotal) * 100));

    return `
        <div class="bar-row">
            <div class="bar-track">
                <div class="bar-fill" style="width:${percent}%; background:${color};"></div>
            </div>
            <div class="bar-value">${value}</div>
        </div>
    `;
}

export default function ClinicianExportsScreen() {
    const params = useLocalSearchParams<{
        patientId?: string;
        patientName?: string;
    }>();

    const patientId = typeof params.patientId === "string" ? params.patientId : "";
    const patientName =
        typeof params.patientName === "string" ? params.patientName : "Selected Patient";

    const [startDate, setStartDate] = useState(() => {
        const start = new Date();
        start.setDate(start.getDate() - 13);
        start.setHours(0, 0, 0, 0);
        return formatInputDate(start);
    });

    const [endDate, setEndDate] = useState(() => {
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        return formatInputDate(end);
    });

    const [exportType, setExportType] = useState<ExportType>("both");
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [exportingCsv, setExportingCsv] = useState(false);

    const [meds, setMeds] = useState<Medication[]>([]);
    const [logsByMed, setLogsByMed] = useState<Record<string, MedicationLog[]>>({});
    const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);

    function validateInputs() {
        if (!patientId) {
            Alert.alert("No patient selected", "Please choose a patient first.");
            return false;
        }

        if (!startDate.trim() || !endDate.trim()) {
            Alert.alert("Missing dates", "Please enter both a start date and end date.");
            return false;
        }

        const parsedStart = parseInputDate(startDate);
        const parsedEnd = parseInputDate(endDate);

        if (!parsedStart || !parsedEnd) {
            Alert.alert("Invalid date", "Please use YYYY-MM-DD for both dates.");
            return false;
        }

        if (parsedStart.getTime() > parsedEnd.getTime()) {
            Alert.alert("Invalid range", "Start date must be before or equal to end date.");
            return false;
        }

        return true;
    }

    async function loadPatientData() {
        if (!patientId) return;

        try {
            setLoading(true);

            const [medsData, symptomsData] = await Promise.all([
                apiFetch(`/api/clinician/patients/${patientId}/medications`),
                apiFetch(`/api/clinician/patients/${patientId}/symptoms`).catch(() => []),
            ]);

            const medList = Array.isArray(medsData) ? medsData : [];
            setMeds(medList);
            setSymptomLogs(Array.isArray(symptomsData) ? symptomsData : []);

            const nextLogsMap: Record<string, MedicationLog[]> = {};

            for (const med of medList) {
                const medId = getId(med);
                if (!medId) continue;

                try {
                    const logs = await apiFetch(
                        `/api/medication-logs/patient/${patientId}/medication/${medId}`
                    );
                    nextLogsMap[medId] = Array.isArray(logs) ? logs : [];
                } catch {
                    nextLogsMap[medId] = [];
                }
            }

            setLogsByMed(nextLogsMap);
        } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed to load patient export data.");
            setMeds([]);
            setLogsByMed({});
            setSymptomLogs([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadPatientData();
    }, [patientId]);

    async function onRefresh() {
        try {
            setRefreshing(true);
            await loadPatientData();
        } finally {
            setRefreshing(false);
        }
    }

    function setLast7Days() {
        const end = new Date();
        end.setHours(0, 0, 0, 0);

        const start = new Date(end);
        start.setDate(end.getDate() - 6);

        setStartDate(formatInputDate(start));
        setEndDate(formatInputDate(end));
    }

    function setLast14Days() {
        const end = new Date();
        end.setHours(0, 0, 0, 0);

        const start = new Date(end);
        start.setDate(end.getDate() - 13);

        setStartDate(formatInputDate(start));
        setEndDate(formatInputDate(end));
    }

    function setLast30Days() {
        const end = new Date();
        end.setHours(0, 0, 0, 0);

        const start = new Date(end);
        start.setDate(end.getDate() - 29);

        setStartDate(formatInputDate(start));
        setEndDate(formatInputDate(end));
    }

    const parsedStartDate = useMemo(() => parseInputDate(startDate), [startDate]);
    const parsedEndDate = useMemo(() => parseInputDate(endDate), [endDate]);

    const filteredMedicationLogs = useMemo<FlattenedMedicationLog[]>(() => {
        if (!parsedStartDate || !parsedEndDate) return [];

        const start = new Date(parsedStartDate);
        const end = new Date(parsedEndDate);
        end.setHours(23, 59, 59, 999);

        return Object.entries(logsByMed)
            .flatMap(([medId, logs]) => {
                const med = meds.find((item) => getId(item) === medId);

                return logs
                    .filter((log) => {
                        if (!log.timestamp) return false;
                        const stamp = new Date(log.timestamp).getTime();
                        return stamp >= start.getTime() && stamp <= end.getTime();
                    })
                    .map((log) => ({
                        medicationName: med?.name ?? "Medication",
                        dosage: med?.dosage ?? "",
                        scheduledTime: log.scheduledTime,
                        status: log.status,
                        timestamp: log.timestamp,
                        note: log.note,
                    }));
            })
            .sort((a, b) => {
                const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return at - bt;
            });
    }, [logsByMed, meds, parsedStartDate, parsedEndDate]);

    const filteredSymptomLogs = useMemo(() => {
        if (!parsedStartDate || !parsedEndDate) return [];

        const start = new Date(parsedStartDate);
        const end = new Date(parsedEndDate);
        end.setHours(23, 59, 59, 999);

        return symptomLogs
            .filter((log) => {
                if (!log.createdAt) return false;
                const stamp = new Date(log.createdAt).getTime();
                return stamp >= start.getTime() && stamp <= end.getTime();
            })
            .sort((a, b) => {
                const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return at - bt;
            });
    }, [symptomLogs, parsedStartDate, parsedEndDate]);

    const medicationTotals = useMemo(() => {
        return filteredMedicationLogs.reduce(
            (acc, log) => {
                if (log.status === "TAKEN") acc.taken += 1;
                else if (log.status === "MISSED") acc.missed += 1;
                else if (log.status === "SKIPPED") acc.skipped += 1;
                return acc;
            },
            { taken: 0, missed: 0, skipped: 0, total: filteredMedicationLogs.length }
        );
    }, [filteredMedicationLogs]);

    const symptomTotals = useMemo(() => {
        return filteredSymptomLogs.reduce(
            (acc, log) => {
                if (log.feeling === "GOOD") acc.good += 1;
                else if (log.feeling === "BAD") acc.bad += 1;
                else acc.neutral += 1;
                return acc;
            },
            { good: 0, neutral: 0, bad: 0, total: filteredSymptomLogs.length }
        );
    }, [filteredSymptomLogs]);

    const dailySummaries = useMemo(() => {
        if (!parsedStartDate || !parsedEndDate) return [];

        const dates: Date[] = [];
        const cursor = new Date(parsedStartDate);
        const last = new Date(parsedEndDate);

        cursor.setHours(0, 0, 0, 0);
        last.setHours(0, 0, 0, 0);

        while (cursor.getTime() <= last.getTime()) {
            dates.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }

        return dates.map((day) => {
            const dateKey = formatInputDate(day);

            const medsForDay = filteredMedicationLogs.filter((log) => {
                if (!log.timestamp) return false;
                return toDateKey(new Date(log.timestamp)) === dateKey;
            });

            const symptomsForDay = filteredSymptomLogs.filter((log) => {
                if (!log.createdAt) return false;
                return toDateKey(new Date(log.createdAt)) === dateKey;
            });

            return {
                dateKey,
                medTaken: medsForDay.filter((l) => l.status === "TAKEN").length,
                medMissed: medsForDay.filter((l) => l.status === "MISSED").length,
                medSkipped: medsForDay.filter((l) => l.status === "SKIPPED").length,
                symptomGood: symptomsForDay.filter((l) => l.feeling === "GOOD").length,
                symptomNeutral: symptomsForDay.filter((l) => !l.feeling || l.feeling === "NEUTRAL").length,
                symptomBad: symptomsForDay.filter((l) => l.feeling === "BAD").length,
            };
        });
    }, [filteredMedicationLogs, filteredSymptomLogs, parsedStartDate, parsedEndDate]);

    const readableText = useMemo(() => {
        const header = [
            `PAUL Clinician Export`,
            `Patient: ${patientName}`,
            `Date Range: ${startDate} to ${endDate}`,
            `Export Type: ${exportType}`,
            ``,
            `This report displays recorded patient patterns and history only.`,
            `It does not provide medical recommendations.`,
            ``,
        ].join("\n");

        const medSection =
            filteredMedicationLogs.length === 0
                ? "Medication Logs\nNo medication logs found in this date range.\n"
                : [
                    "Medication Logs",
                    ...filteredMedicationLogs.map((log, index) => [
                        `${index + 1}. ${log.medicationName ?? "Medication"}`,
                        `   Status: ${log.status ?? "N/A"}`,
                        `   Scheduled time: ${formatTimeLabel(log.scheduledTime)}`,
                        `   Dosage: ${log.dosage ?? "N/A"}`,
                        `   Logged at: ${formatDateTime(log.timestamp)}`,
                        `   Note: ${log.note ?? "None"}`,
                    ].join("\n")),
                    "",
                ].join("\n");

        const symptomSection =
            filteredSymptomLogs.length === 0
                ? "Symptom Logs\nNo symptom logs found in this date range.\n"
                : [
                    "Symptom Logs",
                    ...filteredSymptomLogs.map((log, index) => [
                        `${index + 1}. ${log.symptomName ?? "Symptom"}`,
                        `   Category: ${log.category ?? "N/A"}`,
                        `   Severity: ${log.severity ?? "N/A"}/10`,
                        `   Duration: ${log.durationMinutes ?? "N/A"} min`,
                        `   Feeling: ${log.feeling ?? "N/A"}`,
                        `   Logged at: ${formatDateTime(log.createdAt)}`,
                        `   Note: ${log.note ?? "None"}`,
                    ].join("\n")),
                    "",
                ].join("\n");

        if (exportType === "medications") return `${header}${medSection}`;
        if (exportType === "symptoms") return `${header}${symptomSection}`;
        return `${header}${medSection}\n${symptomSection}`;
    }, [patientName, startDate, endDate, exportType, filteredMedicationLogs, filteredSymptomLogs]);

    const previewCountText = useMemo(() => {
        if (exportType === "medications") {
            return `${filteredMedicationLogs.length} medication log(s) loaded`;
        }
        if (exportType === "symptoms") {
            return `${filteredSymptomLogs.length} symptom log(s) loaded`;
        }
        return `${filteredMedicationLogs.length} medication log(s) and ${filteredSymptomLogs.length} symptom log(s) loaded`;
    }, [exportType, filteredMedicationLogs, filteredSymptomLogs]);

    function buildCsv() {
        if (exportType === "medications") {
            const rows = [
                ["patientName", "date", "medicationName", "dosage", "scheduledTime", "status", "timestamp", "note"],
                ...filteredMedicationLogs.map((log) => [
                    patientName,
                    log.timestamp ? toDateKey(new Date(log.timestamp)) : "",
                    log.medicationName ?? "",
                    log.dosage ?? "",
                    formatTimeLabel(log.scheduledTime),
                    log.status ?? "",
                    log.timestamp ?? "",
                    (log.note ?? "").replace(/\n/g, " "),
                ]),
            ];
            return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
        }

        if (exportType === "symptoms") {
            const rows = [
                ["patientName", "date", "symptomName", "category", "feeling", "severity", "durationMinutes", "createdAt", "note"],
                ...filteredSymptomLogs.map((log) => [
                    patientName,
                    log.createdAt ? toDateKey(new Date(log.createdAt)) : "",
                    log.symptomName ?? "",
                    log.category ?? "",
                    log.feeling ?? "",
                    String(log.severity ?? ""),
                    String(log.durationMinutes ?? ""),
                    log.createdAt ?? "",
                    (log.note ?? "").replace(/\n/g, " "),
                ]),
            ];
            return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
        }

        const medRows = filteredMedicationLogs.map((log) => [
            "MEDICATION",
            patientName,
            log.timestamp ? toDateKey(new Date(log.timestamp)) : "",
            log.medicationName ?? "",
            log.dosage ?? "",
            formatTimeLabel(log.scheduledTime),
            log.status ?? "",
            log.timestamp ?? "",
            (log.note ?? "").replace(/\n/g, " "),
        ]);

        const symptomRows = filteredSymptomLogs.map((log) => [
            "SYMPTOM",
            patientName,
            log.createdAt ? toDateKey(new Date(log.createdAt)) : "",
            log.symptomName ?? "",
            log.category ?? "",
            log.feeling ?? "",
            `${log.severity ?? ""}/10`,
            `${log.durationMinutes ?? ""} min`,
            (log.note ?? "").replace(/\n/g, " "),
        ]);

        const rows = [
            ["recordType", "patientName", "date", "field1", "field2", "field3", "field4", "field5", "note"],
            ...medRows,
            ...symptomRows,
        ];

        return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    }

    function buildExportHtml() {
        const medicationTotalForChart =
            medicationTotals.taken + medicationTotals.missed + medicationTotals.skipped;
        const symptomTotalForChart =
            symptomTotals.good + symptomTotals.neutral + symptomTotals.bad;

        const medicationRows = filteredMedicationLogs.length
            ? filteredMedicationLogs.map(
                (log) => `
                    <tr>
                        <td>${escapeHtml(log.timestamp ? toDateKey(new Date(log.timestamp)) : "Unknown")}</td>
                        <td>${escapeHtml(log.medicationName)}</td>
                        <td>${escapeHtml(log.dosage || "-")}</td>
                        <td>${escapeHtml(formatTimeLabel(log.scheduledTime))}</td>
                        <td>${escapeHtml(log.status)}</td>
                        <td>${escapeHtml(formatDateTime(log.timestamp))}</td>
                    </tr>
                `
            ).join("")
            : `<tr><td colspan="6">No medication logs in this filtered range.</td></tr>`;

        const symptomRows = filteredSymptomLogs.length
            ? filteredSymptomLogs.map(
                (log) => `
                    <tr>
                        <td>${escapeHtml(log.createdAt ? toDateKey(new Date(log.createdAt)) : "Unknown")}</td>
                        <td>${escapeHtml(log.symptomName)}</td>
                        <td>${escapeHtml(log.category || "-")}</td>
                        <td>${escapeHtml(log.feeling || "NEUTRAL")}</td>
                        <td>${escapeHtml(`${log.severity}/10`)}</td>
                        <td>${escapeHtml(`${log.durationMinutes} min`)}</td>
                        <td>${escapeHtml(log.note || "-")}</td>
                    </tr>
                `
            ).join("")
            : `<tr><td colspan="7">No symptom logs in this filtered range.</td></tr>`;

        const dailyCards = dailySummaries.map(
            (day) => `
                <div class="day-card">
                    <div class="day-title">${escapeHtml(day.dateKey)}</div>
                    <div class="day-sub">Medication: ${escapeHtml(
                `${day.medTaken} taken · ${day.medMissed} missed · ${day.medSkipped} skipped`
            )}</div>
                    <div class="day-sub">Symptoms: ${escapeHtml(
                `${day.symptomGood} good · ${day.symptomNeutral} neutral · ${day.symptomBad} bad`
            )}</div>
                </div>
            `
        ).join("");

        return `
            <html>
                <head>
                    <meta charset="utf-8" />
                    <style>
                        body { font-family: Arial, sans-serif; padding: 24px; color: #1f2a44; }
                        h1 { font-size: 24px; margin-bottom: 8px; }
                        h2 { font-size: 18px; margin-top: 24px; margin-bottom: 8px; }
                        h3 { font-size: 15px; margin-bottom: 8px; }
                        p { margin: 4px 0; line-height: 1.5; }
                        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                        .card { background: #f8fafc; border-radius: 12px; padding: 12px; }
                        .big { font-size: 24px; font-weight: bold; }
                        .label { color: #5f6b85; font-size: 13px; }
                        .bar-row { display: flex; align-items: center; gap: 10px; margin: 8px 0 12px; }
                        .bar-track { flex: 1; height: 14px; background: #E5E7EB; border-radius: 999px; overflow: hidden; }
                        .bar-fill { height: 100%; border-radius: 999px; }
                        .bar-value { min-width: 36px; text-align: right; font-weight: 700; }
                        .day-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
                        .day-card { border: 1px solid #d9e2ec; border-radius: 10px; padding: 10px; }
                        .day-title { font-weight: bold; margin-bottom: 4px; }
                        .day-sub { font-size: 12px; color: #5f6b85; }
                        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
                        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
                        th { background: #eaf4fb; }
                    </style>
                </head>
                <body>
                    <h1>PAUL Clinician Export</h1>
                    <p><strong>Patient:</strong> ${escapeHtml(patientName)}</p>
                    <p><strong>Date range:</strong> ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</p>
                    <p><strong>Export type:</strong> ${escapeHtml(exportType)}</p>
                    <p>This report displays recorded patient patterns and history only. It does not provide medical recommendations.</p>

                    ${
            exportType === "medications" || exportType === "both"
                ? `
                            <h2>Medication Overview</h2>
                            <div class="grid">
                                <div class="card"><div class="big">${medicationTotals.taken}</div><div class="label">Taken</div></div>
                                <div class="card"><div class="big">${medicationTotals.missed}</div><div class="label">Missed</div></div>
                                <div class="card"><div class="big">${medicationTotals.skipped}</div><div class="label">Skipped</div></div>
                                <div class="card"><div class="big">${medicationTotals.total}</div><div class="label">Total</div></div>
                            </div>

                            <div class="card" style="margin-top: 12px;">
                                <h3>Medication Visual</h3>
                                <p>Taken</p>
                                ${buildBar(medicationTotals.taken, medicationTotalForChart, "#16A34A")}
                                <p>Missed</p>
                                ${buildBar(medicationTotals.missed, medicationTotalForChart, "#DC2626")}
                                <p>Skipped</p>
                                ${buildBar(medicationTotals.skipped, medicationTotalForChart, "#6B7280")}
                            </div>

                            <h2>Medication Logs</h2>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Medication</th>
                                        <th>Dosage</th>
                                        <th>Scheduled</th>
                                        <th>Status</th>
                                        <th>Logged</th>
                                    </tr>
                                </thead>
                                <tbody>${medicationRows}</tbody>
                            </table>
                        `
                : ""
        }

                    ${
            exportType === "symptoms" || exportType === "both"
                ? `
                            <h2>Symptom Overview</h2>
                            <div class="grid">
                                <div class="card"><div class="big">${symptomTotals.good}</div><div class="label">Good</div></div>
                                <div class="card"><div class="big">${symptomTotals.neutral}</div><div class="label">Neutral</div></div>
                                <div class="card"><div class="big">${symptomTotals.bad}</div><div class="label">Bad</div></div>
                                <div class="card"><div class="big">${symptomTotals.total}</div><div class="label">Total</div></div>
                            </div>

                            <div class="card" style="margin-top: 12px;">
                                <h3>Symptom Visual</h3>
                                <p>Good</p>
                                ${buildBar(symptomTotals.good, symptomTotalForChart, "#16A34A")}
                                <p>Neutral</p>
                                ${buildBar(symptomTotals.neutral, symptomTotalForChart, "#F59E0B")}
                                <p>Bad</p>
                                ${buildBar(symptomTotals.bad, symptomTotalForChart, "#DC2626")}
                            </div>

                            <h2>Symptom Logs</h2>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Symptom</th>
                                        <th>Category</th>
                                        <th>Feeling</th>
                                        <th>Severity</th>
                                        <th>Duration</th>
                                        <th>Note</th>
                                    </tr>
                                </thead>
                                <tbody>${symptomRows}</tbody>
                            </table>
                        `
                : ""
        }

                    <h2>Daily Summary</h2>
                    <div class="day-grid">${dailyCards || "<p>No daily summary data.</p>"}</div>
                </body>
            </html>
        `;
    }

    async function exportCsv() {
        if (!validateInputs()) return;

        try {
            setExportingCsv(true);

            const csv = buildCsv();
            const fileUri =
                FileSystem.documentDirectory +
                safeFileName(`${patientName}-${exportType}-${startDate}-to-${endDate}.csv`);

            await FileSystem.writeAsStringAsync(fileUri, csv, {
                encoding: FileSystem.EncodingType.UTF8,
            });

            await Sharing.shareAsync(fileUri, {
                mimeType: "text/csv",
                dialogTitle: "Export CSV",
                UTI: "public.comma-separated-values-text",
            });
        } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed to export CSV.");
        } finally {
            setExportingCsv(false);
        }
    }

    async function exportPdf() {
        if (!validateInputs()) return;

        try {
            setExportingPdf(true);

            const html = buildExportHtml();
            const { uri } = await Print.printToFileAsync({ html });

            await Sharing.shareAsync(uri, {
                mimeType: "application/pdf",
                dialogTitle: "Export PDF",
                UTI: "com.adobe.pdf",
            });
        } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed to export PDF.");
        } finally {
            setExportingPdf(false);
        }
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                <Text style={styles.title}>Patient Exports</Text>

                <View style={styles.card}>
                    <Text style={styles.label}>Selected patient</Text>
                    <Text style={styles.patientName}>{patientName}</Text>
                    {!patientId ? (
                        <Text style={styles.warning}>
                            No patient selected. Please go back and choose a patient.
                        </Text>
                    ) : null}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Date Range</Text>

                    <Text style={styles.label}>Start date</Text>
                    <TextInput
                        value={startDate}
                        onChangeText={setStartDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#7b8794"
                        style={styles.input}
                    />

                    <Text style={styles.label}>End date</Text>
                    <TextInput
                        value={endDate}
                        onChangeText={setEndDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#7b8794"
                        style={styles.input}
                    />

                    <View style={styles.quickRangeRow}>
                        <Pressable style={styles.quickRangeButton} onPress={setLast7Days}>
                            <Text style={styles.quickRangeButtonText}>Last 7 Days</Text>
                        </Pressable>
                        <Pressable style={styles.quickRangeButton} onPress={setLast14Days}>
                            <Text style={styles.quickRangeButtonText}>Last 14 Days</Text>
                        </Pressable>
                        <Pressable style={styles.quickRangeButton} onPress={setLast30Days}>
                            <Text style={styles.quickRangeButtonText}>Last 30 Days</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Choose Data to Review</Text>

                    <View style={styles.segmentRow}>
                        <Pressable
                            style={[
                                styles.segmentButton,
                                exportType === "medications" && styles.segmentButtonActive,
                            ]}
                            onPress={() => setExportType("medications")}
                        >
                            <Text
                                style={[
                                    styles.segmentText,
                                    exportType === "medications" && styles.segmentTextActive,
                                ]}
                            >
                                Medications
                            </Text>
                        </Pressable>

                        <Pressable
                            style={[
                                styles.segmentButton,
                                exportType === "symptoms" && styles.segmentButtonActive,
                            ]}
                            onPress={() => setExportType("symptoms")}
                        >
                            <Text
                                style={[
                                    styles.segmentText,
                                    exportType === "symptoms" && styles.segmentTextActive,
                                ]}
                            >
                                Symptoms
                            </Text>
                        </Pressable>

                        <Pressable
                            style={[
                                styles.segmentButton,
                                exportType === "both" && styles.segmentButtonActive,
                            ]}
                            onPress={() => setExportType("both")}
                        >
                            <Text
                                style={[
                                    styles.segmentText,
                                    exportType === "both" && styles.segmentTextActive,
                                ]}
                            >
                                Both
                            </Text>
                        </Pressable>
                    </View>

                    <Pressable style={styles.primaryButton} onPress={loadPatientData}>
                        <Text style={styles.primaryButtonText}>
                            {loading ? "Loading..." : "Reload Patient Data"}
                        </Text>
                    </Pressable>

                    <Text style={styles.helper}>{previewCountText}</Text>
                </View>

                {exportType !== "symptoms" && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Medication Overview</Text>
                        <View style={styles.statsGrid}>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{medicationTotals.taken}</Text>
                                <Text style={styles.statLabel}>Taken</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{medicationTotals.missed}</Text>
                                <Text style={styles.statLabel}>Missed</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{medicationTotals.skipped}</Text>
                                <Text style={styles.statLabel}>Skipped</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{medicationTotals.total}</Text>
                                <Text style={styles.statLabel}>Total</Text>
                            </View>
                        </View>
                    </View>
                )}

                {exportType !== "medications" && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Symptom Overview</Text>
                        <View style={styles.statsGrid}>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{symptomTotals.good}</Text>
                                <Text style={styles.statLabel}>Good</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{symptomTotals.neutral}</Text>
                                <Text style={styles.statLabel}>Neutral</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{symptomTotals.bad}</Text>
                                <Text style={styles.statLabel}>Bad</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{symptomTotals.total}</Text>
                                <Text style={styles.statLabel}>Total</Text>
                            </View>
                        </View>
                    </View>
                )}

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Export Options</Text>

                    <Pressable
                        style={[styles.primaryButton, exportingPdf && styles.disabled]}
                        onPress={exportPdf}
                        disabled={exportingPdf}
                    >
                        <Text style={styles.primaryButtonText}>
                            {exportingPdf ? "Exporting PDF..." : "Export PDF"}
                        </Text>
                    </Pressable>

                    <Pressable
                        style={[styles.secondaryButton, exportingCsv && styles.disabled]}
                        onPress={exportCsv}
                        disabled={exportingCsv}
                    >
                        <Text style={styles.secondaryButtonText}>
                            {exportingCsv ? "Exporting CSV..." : "Export CSV"}
                        </Text>
                    </Pressable>

                    <Text style={styles.note}>
                        Exports contain recorded patient patterns and history only. They do
                        not include treatment recommendations.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Readable Preview</Text>

                    {exportType !== "symptoms" && (
                        <>
                            <Text style={styles.previewSectionTitle}>Medication Logs</Text>
                            {filteredMedicationLogs.length === 0 ? (
                                <Text style={styles.empty}>No medication logs loaded.</Text>
                            ) : (
                                filteredMedicationLogs.map((log, index) => (
                                    <View key={`med-${index}`} style={styles.item}>
                                        <Text style={styles.itemTitle}>
                                            {log.medicationName ?? "Medication"}
                                        </Text>
                                        <Text style={styles.itemSub}>Status: {log.status ?? "N/A"}</Text>
                                        <Text style={styles.itemSub}>
                                            Scheduled: {formatTimeLabel(log.scheduledTime)}
                                        </Text>
                                        <Text style={styles.itemSub}>Dosage: {log.dosage ?? "N/A"}</Text>
                                        <Text style={styles.itemSub}>
                                            Logged: {formatDateTime(log.timestamp)}
                                        </Text>
                                        {!!log.note && <Text style={styles.itemNote}>{log.note}</Text>}
                                    </View>
                                ))
                            )}
                        </>
                    )}

                    {exportType !== "medications" && (
                        <>
                            <Text style={styles.previewSectionTitle}>Symptom Logs</Text>
                            {filteredSymptomLogs.length === 0 ? (
                                <Text style={styles.empty}>No symptom logs loaded.</Text>
                            ) : (
                                filteredSymptomLogs.map((log, index) => (
                                    <View key={log.id ?? log._id ?? `sym-${index}`} style={styles.item}>
                                        <Text style={styles.itemTitle}>{log.symptomName}</Text>
                                        <Text style={styles.itemSub}>Category: {log.category ?? "N/A"}</Text>
                                        <Text style={styles.itemSub}>Severity: {log.severity}/10</Text>
                                        <Text style={styles.itemSub}>Duration: {log.durationMinutes} min</Text>
                                        <Text style={styles.itemSub}>Feeling: {log.feeling ?? "N/A"}</Text>
                                        <Text style={styles.itemSub}>Logged: {formatDateTime(log.createdAt)}</Text>
                                        {!!log.note && <Text style={styles.itemNote}>{log.note}</Text>}
                                    </View>
                                ))
                            )}
                        </>
                    )}

                    <Text style={styles.readableText}>{readableText}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: "#f7f8fb",
    },
    container: {
        padding: 20,
        gap: 16,
        paddingBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#1f2a44",
    },
    card: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 18,
        gap: 10,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#1f2a44",
    },
    label: {
        fontSize: 13,
        fontWeight: "700",
        color: "#5f6b85",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    patientName: {
        fontSize: 22,
        fontWeight: "800",
        color: "#1f2a44",
    },
    warning: {
        color: "#b42318",
        fontSize: 14,
        lineHeight: 20,
    },
    input: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#d9e2ec",
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: "#1f2a44",
    },
    quickRangeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 6,
    },
    quickRangeButton: {
        backgroundColor: "#eef2f7",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    quickRangeButtonText: {
        color: "#1f2a44",
        fontWeight: "700",
        fontSize: 13,
    },
    segmentRow: {
        flexDirection: "row",
        gap: 10,
        flexWrap: "wrap",
    },
    segmentButton: {
        flex: 1,
        minWidth: 90,
        backgroundColor: "#eef2f7",
        paddingVertical: 12,
        borderRadius: 14,
        alignItems: "center",
    },
    segmentButtonActive: {
        backgroundColor: "#1f2a44",
    },
    segmentText: {
        color: "#1f2a44",
        fontWeight: "700",
    },
    segmentTextActive: {
        color: "white",
    },
    primaryButton: {
        backgroundColor: "#1f2a44",
        paddingVertical: 13,
        borderRadius: 14,
        alignItems: "center",
        marginTop: 4,
    },
    primaryButtonText: {
        color: "white",
        fontWeight: "800",
        fontSize: 15,
    },
    secondaryButton: {
        backgroundColor: "#e9eef5",
        paddingVertical: 13,
        borderRadius: 14,
        alignItems: "center",
    },
    secondaryButtonText: {
        color: "#1f2a44",
        fontWeight: "800",
        fontSize: 15,
    },
    helper: {
        color: "#5f6b85",
        fontSize: 13,
    },
    note: {
        color: "#5f6b85",
        lineHeight: 20,
        fontSize: 13,
    },
    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    statCard: {
        flexGrow: 1,
        minWidth: "45%",
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#e6edf5",
        borderRadius: 14,
        padding: 14,
    },
    statValue: {
        fontSize: 22,
        fontWeight: "800",
        color: "#1f2a44",
    },
    statLabel: {
        marginTop: 4,
        color: "#5f6b85",
        fontSize: 13,
        fontWeight: "700",
    },
    previewSectionTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#1f2a44",
        marginTop: 4,
        marginBottom: 4,
    },
    item: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#e6edf5",
        borderRadius: 14,
        padding: 12,
        gap: 4,
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: "800",
        color: "#1f2a44",
    },
    itemSub: {
        fontSize: 13,
        color: "#4a5568",
    },
    itemNote: {
        marginTop: 4,
        fontSize: 13,
        color: "#1f2a44",
        fontStyle: "italic",
    },
    empty: {
        color: "#7b8794",
        fontSize: 14,
    },
    readableText: {
        marginTop: 12,
        color: "#6b7280",
        fontSize: 12,
        lineHeight: 18,
    },
    disabled: {
        opacity: 0.7,
    },
});
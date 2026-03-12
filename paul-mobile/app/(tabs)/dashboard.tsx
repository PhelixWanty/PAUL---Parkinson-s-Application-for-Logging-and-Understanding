// app/(tabs)/dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { apiFetch } from "../../lib/api";

type Medication = {
  id?: string;
  _id?: string;
  name: string;
  dosage?: string;
  times?: string[]; // e.g. ["08:00","14:00"] (24h format)
  active?: boolean;
};

type MedicationLog = {
  id?: string;
  _id?: string;
  medicationId: string;
  status: "TAKEN" | "MISSED";
  scheduledAt?: string; // ISO (recommended)
  takenAt?: string;     // ISO (optional)
  loggedAt?: string;    // ISO (optional)
};

type NextDose = {
  medicationId: string;
  medicationName: string;
  dosage?: string;
  scheduledAt: string; // ISO
  displayTime: string; // "8:00 AM"
};

function getId(m: Medication) {
  return m.id ?? m._id ?? "";
}

function parseHHMM(hhmm: string) {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function sameMinute(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const minute = 60_000;
  return Math.floor(a / minute) === Math.floor(b / minute);
}

/**
 * ✅ Core rule:
 * - Only show doses scheduled TODAY
 * - Only show doses that are still upcoming (>= now)
 * - If a dose is logged (TAKEN or MISSED) for that scheduledAt, do not show it
 *   → Once-a-day meds disappear after taken (no more times today)
 *   → Multi-dose meds roll forward to the next time today
 */
function computeTodayUpcomingDoses(
  meds: Medication[],
  logsByMed: Record<string, MedicationLog[]>,
  maxItems = 8
): NextDose[] {
  const now = new Date();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const doses: NextDose[] = [];

  for (const med of meds) {
    if (med.active === false) continue;
    const medId = getId(med);
    if (!medId) continue;

    const times = (med.times ?? []).filter(Boolean);
    if (!times.length) continue;

    for (const t of times) {
      const parsed = parseHHMM(t);
      if (!parsed) continue;

      const scheduled = new Date();
      scheduled.setSeconds(0, 0);
      scheduled.setHours(parsed.h, parsed.m, 0, 0);

      // today only
      if (scheduled < todayStart || scheduled > todayEnd) continue;

      // upcoming only (if you want "due earlier today but not taken", remove this line)
      if (scheduled.getTime() < now.getTime()) continue;

      const scheduledIso = scheduled.toISOString();

      // exclude already logged
      const logs = logsByMed[medId] ?? [];
      const alreadyLogged = logs.some((log) => {
        const when = log.scheduledAt ?? log.takenAt ?? log.loggedAt;
        if (!when) return false;
        return sameMinute(when, scheduledIso);
      });

      if (alreadyLogged) continue;

      doses.push({
        medicationId: medId,
        medicationName: med.name,
        dosage: med.dosage,
        scheduledAt: scheduledIso,
        displayTime: formatTime(scheduled),
      });
    }
  }

  doses.sort(
    (a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  return doses.slice(0, maxItems);
}

export default function Dashboard() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);

  // logsByMedicationId[medId] = list of logs
  const [logsByMed, setLogsByMed] = useState<Record<string, MedicationLog[]>>(
    {}
  );

  async function loadMedsAndLogs() {
    try {
      setLoading(true);

      // 1) Load meds
      const medsData = await apiFetch("/api/medications");
      const medList: Medication[] = Array.isArray(medsData) ? medsData : [];
      setMeds(medList);

      // 2) Load logs for each medication
      const nextLogsByMed: Record<string, MedicationLog[]> = {};

      for (const med of medList) {
        const id = getId(med);
        if (!id) continue;

        try {
          const logs = await apiFetch(`/api/medication-logs/medication/${id}`);
          nextLogsByMed[id] = Array.isArray(logs) ? logs : [];
        } catch {
          nextLogsByMed[id] = [];
        }
      }

      setLogsByMed(nextLogsByMed);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  const nextDoses = useMemo(
    () => computeTodayUpcomingDoses(meds, logsByMed, 8),
    [meds, logsByMed]
  );

  async function markDose(dose: NextDose, status: "TAKEN" | "MISSED") {
    try {
      await apiFetch("/api/medication-logs", {
        method: "POST",
        body: JSON.stringify({
          medicationId: dose.medicationId,
          scheduledAt: dose.scheduledAt, // adjust only if your DTO uses a different name
          status,
        }),
      });

      Alert.alert("Saved", status === "TAKEN" ? "Marked as taken ✅" : "Marked as missed ❌");

      // ✅ After logging, refresh: dashboard will automatically roll forward or hide
      await loadMedsAndLogs();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save dose log");
    }
  }

  useEffect(() => {
    loadMedsAndLogs();
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: "900" }}>Dashboard</Text>

        <Pressable
          onPress={loadMedsAndLogs}
          disabled={loading}
          style={{
            backgroundColor: "black",
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 12,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "white", fontWeight: "900" }}>
            {loading ? "Loading..." : "Refresh"}
          </Text>
        </Pressable>
      </View>

      <View style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 20, fontWeight: "900" }}>Next doses (today)</Text>

        {nextDoses.length === 0 ? (
          <Text style={{ fontSize: 16, opacity: 0.8 }}>
            No upcoming doses today. If you already marked today’s dose as taken,
            once-a-day meds will disappear and multi-dose meds will roll forward
            to the next scheduled time.
          </Text>
        ) : (
          nextDoses.map((dose) => (
            <View
              key={`${dose.medicationId}|${dose.scheduledAt}`}
              style={{ borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 18, fontWeight: "900" }}>
                  {dose.medicationName}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: "800" }}>
                  {dose.displayTime}
                </Text>
              </View>

              {dose.dosage ? (
                <Text style={{ fontSize: 16, opacity: 0.85 }}>
                  Dosage: {dose.dosage}
                </Text>
              ) : null}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => markDose(dose, "TAKEN")}
                  style={{
                    flex: 1,
                    backgroundColor: "black",
                    padding: 12,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>Taken</Text>
                </Pressable>

                <Pressable
                  onPress={() => markDose(dose, "MISSED")}
                  style={{
                    flex: 1,
                    backgroundColor: "gray",
                    padding: 12,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>Missed</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
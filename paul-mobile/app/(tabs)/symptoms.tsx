import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { apiFetch } from "../../lib/api";

type SymptomCategory = "MOTOR" | "NON_MOTOR" | "CUSTOM";

type SymptomLog = {
  id: string;
  category: SymptomCategory;
  symptomName: string;
  severity: number; // 1-10
  durationMinutes: number; // >=0
  note?: string;
  createdAt: string;
};

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

export default function SymptomsScreen() {
  const [category, setCategory] = useState<SymptomCategory>("MOTOR");
  const [selectedCommon, setSelectedCommon] = useState<string>("Tremor");
  const [customName, setCustomName] = useState<string>("");

  const [severity, setSeverity] = useState<number>(5);
  const [durationMinutes, setDurationMinutes] = useState<string>("30");
  const [note, setNote] = useState<string>("");

  // local list so page works even before backend exists
  const [recent, setRecent] = useState<SymptomLog[]>([]);
  const [saving, setSaving] = useState(false);

  const commonList = useMemo(() => {
    if (category === "MOTOR") return MOTOR_SYMPTOMS;
    if (category === "NON_MOTOR") return NON_MOTOR_SYMPTOMS;
    return [];
  }, [category]);

  const symptomName = useMemo(() => {
    if (category === "CUSTOM") return customName.trim();
    return selectedCommon;
  }, [category, selectedCommon, customName]);

  function clampSeverity(n: number) {
    if (n < 1) return 1;
    if (n > 10) return 10;
    return n;
  }

  async function saveLog() {
    const dur = Number(durationMinutes);

    if (!symptomName) {
      Alert.alert("Missing", "Please enter a symptom name.");
      return;
    }
    if (!Number.isFinite(dur) || dur < 0) {
      Alert.alert("Invalid", "Duration must be a valid number of minutes (0 or more).");
      return;
    }

    const payload = {
      category,
      symptomName,
      severity: clampSeverity(severity),
      durationMinutes: Math.floor(dur),
      note: note.trim() || undefined,
    };

    try {
      setSaving(true);

      // ✅ If you have a backend endpoint, this will persist:
      // POST /api/symptom-logs
      // Body: payload
      const saved = await apiFetch("/api/symptom-logs", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // If backend returns the saved log, use it; otherwise create a local one
      const created: SymptomLog = saved?.createdAt
        ? {
            id: saved.id ?? saved._id ?? String(Date.now()),
            category: saved.category ?? category,
            symptomName: saved.symptomName ?? symptomName,
            severity: saved.severity ?? payload.severity,
            durationMinutes: saved.durationMinutes ?? payload.durationMinutes,
            note: saved.note ?? payload.note,
            createdAt: saved.createdAt ?? new Date().toISOString(),
          }
        : {
            id: String(Date.now()),
            ...payload,
            createdAt: new Date().toISOString(),
          };

      setRecent((prev) => [created, ...prev].slice(0, 20));

      Alert.alert("Saved", "Symptom logged ✅");

      // reset some fields (optional)
      setNote("");
    } catch (e: any) {
      // If endpoint doesn't exist yet, keep it local
      const created: SymptomLog = {
        id: String(Date.now()),
        category,
        symptomName,
        severity: clampSeverity(severity),
        durationMinutes: Math.floor(Number(durationMinutes) || 0),
        note: note.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      setRecent((prev) => [created, ...prev].slice(0, 20));

      Alert.alert(
        "Saved (local)",
        "Backend symptom endpoint isn’t set up yet. This was saved locally as a placeholder."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Text style={{ fontSize: 28, fontWeight: "900" }}>Symptoms</Text>

      {/* Category selector */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {(["MOTOR", "NON_MOTOR", "CUSTOM"] as SymptomCategory[]).map((c) => {
          const active = category === c;
          return (
            <Pressable
              key={c}
              onPress={() => {
                setCategory(c);
                if (c !== "CUSTOM" && commonList.length) {
                  setSelectedCommon(commonList[0]);
                }
              }}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                backgroundColor: active ? "black" : "white",
                alignItems: "center",
              }}
            >
              <Text style={{ fontWeight: "900", color: active ? "white" : "black" }}>
                {c === "MOTOR" ? "Motor" : c === "NON_MOTOR" ? "Non-Motor" : "Custom"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Symptom picker */}
      <View style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "900" }}>Symptom</Text>

        {category === "CUSTOM" ? (
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder="Type your symptom (e.g., dizziness)"
            style={{ borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18 }}
          />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {commonList.map((s) => {
              const active = selectedCommon === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSelectedCommon(s)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    backgroundColor: active ? "black" : "white",
                  }}
                >
                  <Text style={{ fontWeight: "800", color: active ? "white" : "black" }}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Severity + Duration */}
      <View style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "900" }}>Severity (1–10)</Text>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => setSeverity((v) => clampSeverity(v - 1))}
            style={{ padding: 12, borderWidth: 1, borderRadius: 12 }}
          >
            <Text style={{ fontWeight: "900", fontSize: 18 }}>−</Text>
          </Pressable>

          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12, padding: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: "900" }}>{severity}</Text>
          </View>

          <Pressable
            onPress={() => setSeverity((v) => clampSeverity(v + 1))}
            style={{ padding: 12, borderWidth: 1, borderRadius: 12 }}
          >
            <Text style={{ fontWeight: "900", fontSize: 18 }}>+</Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: 18, fontWeight: "900" }}>Duration (minutes)</Text>
        <TextInput
          value={durationMinutes}
          onChangeText={setDurationMinutes}
          keyboardType="numeric"
          placeholder="e.g., 30"
          style={{ borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18 }}
        />

        <Text style={{ fontSize: 18, fontWeight: "900" }}>Notes (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Anything else? triggers, context, etc."
          style={{ borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18 }}
        />

        <Pressable
          onPress={saveLog}
          disabled={saving}
          style={{
            backgroundColor: "black",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>
            {saving ? "Saving..." : "Log Symptom"}
          </Text>
        </Pressable>
      </View>

      {/* Recent logs */}
      <View style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "900" }}>Recent logs</Text>

        {recent.length === 0 ? (
          <Text style={{ opacity: 0.8, fontSize: 16 }}>No symptom logs yet.</Text>
        ) : (
          recent.map((r) => (
            <View key={r.id} style={{ borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: "900" }}>
                {r.symptomName} ({r.category === "MOTOR" ? "Motor" : r.category === "NON_MOTOR" ? "Non-Motor" : "Custom"})
              </Text>
              <Text style={{ fontSize: 16 }}>Severity: {r.severity}/10</Text>
              <Text style={{ fontSize: 16 }}>Duration: {r.durationMinutes} min</Text>
              <Text style={{ fontSize: 14, opacity: 0.7 }}>
                {new Date(r.createdAt).toLocaleString()}
              </Text>
              {r.note ? <Text style={{ fontSize: 16 }}>Note: {r.note}</Text> : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
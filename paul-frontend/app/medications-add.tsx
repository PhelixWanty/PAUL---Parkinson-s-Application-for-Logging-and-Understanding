import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { router } from "expo-router";
import { apiFetch } from "../lib/api";

export default function MedicationsAdd() {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [times, setTimes] = useState("08:00,14:00");
  const [error, setError] = useState("");

  async function save() {
    try {
      setError("");
      await apiFetch("/api/medications", {
        method: "POST",
        body: JSON.stringify({
          name,
          dosage,
          times: times.split(",").map(t => t.trim()).filter(Boolean),
          active: true
        })
      });
      router.back();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 26, fontWeight: "800" }}>Add Medication</Text>

      <TextInput
        placeholder="Name (e.g., Levodopa)"
        value={name}
        onChangeText={setName}
        style={{ borderWidth: 1, padding: 14, borderRadius: 12, fontSize: 18 }}
      />
      <TextInput
        placeholder="Dosage (e.g., 10mg)"
        value={dosage}
        onChangeText={setDosage}
        style={{ borderWidth: 1, padding: 14, borderRadius: 12, fontSize: 18 }}
      />
      <TextInput
        placeholder="Times (comma separated, e.g., 08:00,14:00)"
        value={times}
        onChangeText={setTimes}
        style={{ borderWidth: 1, padding: 14, borderRadius: 12, fontSize: 18 }}
      />

      {error ? <Text style={{ color: "red", fontSize: 16 }}>{error}</Text> : null}

      <Pressable
        onPress={save}
        style={{ backgroundColor: "black", padding: 16, borderRadius: 12, alignItems: "center" }}
      >
        <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>Save</Text>
      </Pressable>
    </View>
  );
}
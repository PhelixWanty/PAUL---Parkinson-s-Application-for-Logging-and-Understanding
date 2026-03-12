import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Modal,
} from "react-native";
import { apiFetch } from "../../lib/api";

type Medication = {
  id?: string;
  _id?: string; // if backend returns Mongo-style
  name: string;
  dosage?: string;
  instructions?: string;
  times?: string[]; // ["08:00","14:00"]
  active?: boolean;
};

function getId(m: Medication) {
  return m.id ?? m._id ?? "";
}

export default function MedicationsScreen() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);

  // Add form
  const [newName, setNewName] = useState("");
  const [newDosage, setNewDosage] = useState("");
  const [newTime1, setNewTime1] = useState("08:00");
  const [newTime2, setNewTime2] = useState("");

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editMed, setEditMed] = useState<Medication | null>(null);
  const [editName, setEditName] = useState("");
  const [editDosage, setEditDosage] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editTime1, setEditTime1] = useState("");
  const [editTime2, setEditTime2] = useState("");
  const [editActive, setEditActive] = useState(true);

  async function loadMeds() {
    try {
      setLoading(true);
      const data = await apiFetch("/api/medications");
      setMeds(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to load medications");
    } finally {
      setLoading(false);
    }
  }

  async function addMedication() {
    if (!newName.trim()) {
      Alert.alert("Missing", "Medication name is required.");
      return;
    }

    const times = [newTime1.trim(), newTime2.trim()].filter(Boolean);

    try {
      setLoading(true);

      await apiFetch("/api/medications", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          dosage: newDosage.trim() || undefined,
          times: times.length ? times : undefined,
          active: true,
        }),
      });

      setNewName("");
      setNewDosage("");
      setNewTime1("08:00");
      setNewTime2("");

      await loadMeds();
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
    setEditTime1(m.times?.[0] ?? "");
    setEditTime2(m.times?.[1] ?? "");
    setEditActive(m.active !== false);
    setEditOpen(true);
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

    const times = [editTime1.trim(), editTime2.trim()].filter(Boolean);

    try {
      setLoading(true);

      await apiFetch(`/api/medications/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          dosage: editDosage.trim() || undefined,
          instructions: editInstructions.trim() || undefined,
          times: times.length ? times : undefined,
          active: editActive,
        }),
      });

      setEditOpen(false);
      setEditMed(null);
      await loadMeds();
      Alert.alert("Updated", "Medication updated ✅");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update medication");
    } finally {
      setLoading(false);
    }
  }

  async function deleteMed(m: Medication) {
    const id = getId(m);
    if (!id) {
      Alert.alert("Error", "This medication has no id. Backend must return id/_id.");
      return;
    }

    Alert.alert(
      "Delete medication?",
      `Delete "${m.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await apiFetch(`/api/medications/${id}`, { method: "DELETE" });
              await loadMeds();
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to delete medication");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  useEffect(() => {
    loadMeds();
  }, []);

  const hasMeds = useMemo(() => meds.length > 0, [meds]);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "900" }}>Medications</Text>

        <Pressable
          onPress={loadMeds}
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

      {/* Add Medication */}
      <View style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 20, fontWeight: "900" }}>Add Medication</Text>

        <Text style={{ fontSize: 16, fontWeight: "800" }}>Name</Text>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g., Carbidopa/Levodopa"
          style={{ borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18 }}
        />

        <Text style={{ fontSize: 16, fontWeight: "800" }}>Dosage (optional)</Text>
        <TextInput
          value={newDosage}
          onChangeText={setNewDosage}
          placeholder="e.g., 25/100mg"
          style={{ borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18 }}
        />

        <Text style={{ fontSize: 16, fontWeight: "800" }}>Times (optional)</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TextInput
            value={newTime1}
            onChangeText={setNewTime1}
            placeholder="08:00"
            style={{ flex: 1, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18 }}
          />
          <TextInput
            value={newTime2}
            onChangeText={setNewTime2}
            placeholder="14:00"
            style={{ flex: 1, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18 }}
          />
        </View>

        <Pressable
          onPress={addMedication}
          disabled={loading}
          style={{
            backgroundColor: "black",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>
            {loading ? "Saving..." : "Add Medication"}
          </Text>
        </Pressable>
      </View>

      {/* List */}
      <View style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 20, fontWeight: "900" }}>Your Medications</Text>

        {!hasMeds ? (
          <Text style={{ fontSize: 16, opacity: 0.8 }}>
            No medications yet. Add one above.
          </Text>
        ) : (
          meds.map((m) => (
            <View
              key={getId(m) || `${m.name}-${(m.times || []).join(",")}`}
              style={{ borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 }}
            >
              <Text style={{ fontSize: 20, fontWeight: "900" }}>{m.name}</Text>
              {m.dosage ? <Text style={{ fontSize: 16 }}>Dosage: {m.dosage}</Text> : null}
              {m.times?.length ? (
                <Text style={{ fontSize: 16 }}>Times: {m.times.join(", ")}</Text>
              ) : (
                <Text style={{ fontSize: 16, opacity: 0.8 }}>Times: Not set</Text>
              )}
              <Text style={{ fontSize: 16, opacity: 0.8 }}>
                Status: {m.active === false ? "Inactive" : "Active"}
              </Text>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => openEdit(m)}
                  style={{
                    flex: 1,
                    backgroundColor: "black",
                    padding: 12,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>Edit</Text>
                </Pressable>

                <Pressable
                  onPress={() => deleteMed(m)}
                  style={{
                    flex: 1,
                    backgroundColor: "gray",
                    padding: 12,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Edit Modal */}
      <Modal visible={editOpen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, gap: 10 }}>
            <Text style={{ fontSize: 20, fontWeight: "900" }}>Edit Medication</Text>

            <Text style={{ fontSize: 16, fontWeight: "800" }}>Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={{ borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18 }}
            />

            <Text style={{ fontSize: 16, fontWeight: "800" }}>Dosage</Text>
            <TextInput
              value={editDosage}
              onChangeText={setEditDosage}
              style={{ borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18 }}
            />

            <Text style={{ fontSize: 16, fontWeight: "800" }}>Instructions</Text>
            <TextInput
              value={editInstructions}
              onChangeText={setEditInstructions}
              placeholder="e.g., Take with food"
              style={{ borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18 }}
            />

            <Text style={{ fontSize: 16, fontWeight: "800" }}>Times</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                value={editTime1}
                onChangeText={setEditTime1}
                placeholder="08:00"
                style={{ flex: 1, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18 }}
              />
              <TextInput
                value={editTime2}
                onChangeText={setEditTime2}
                placeholder="14:00"
                style={{ flex: 1, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18 }}
              />
            </View>

            <Pressable
              onPress={() => setEditActive((v) => !v)}
              style={{
                borderWidth: 1,
                borderRadius: 12,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "900" }}>
                Active: {editActive ? "Yes" : "No"} (tap to toggle)
              </Text>
            </Pressable>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <Pressable
                onPress={() => {
                  setEditOpen(false);
                  setEditMed(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: "gray",
                  padding: 12,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "900" }}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={saveEdit}
                disabled={loading}
                style={{
                  flex: 1,
                  backgroundColor: "black",
                  padding: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "white", fontWeight: "900" }}>
                  {loading ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
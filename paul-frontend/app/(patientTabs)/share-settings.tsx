import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch } from "../../lib/api";

type ShareSettings = {
  shareWeeklySummariesWithCaregiver: boolean;
  shareSymptomTrendsWithCaregiver: boolean;
  shareMissedDoseAlertsWithCaregiver: boolean;
  shareClinicianReports: boolean;
};

type ConnectionType = "CAREGIVER" | "CLINICIAN";
type ConnectionStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";

type PatientConnection = {
  id: string;

  patientId?: string;
  patientName?: string;
  patientEmail?: string;
  patientCode?: string;

  connectedUserId?: string;
  connectedUserName?: string;
  connectedUserEmail?: string;
  connectedUserCode?: string;

  connectionType: ConnectionType;
  status: ConnectionStatus;

  patientAccepted?: boolean;
  connectedUserAccepted?: boolean;
  fullyAccepted?: boolean;

  requestedByUserId?: string;
  requestedAt?: string;
  patientAcceptedAt?: string;
  connectedUserAcceptedAt?: string;
  finalizedAt?: string;
};

type MeResponse = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  userCode?: string;
};

type DisplayConnection = PatientConnection & {
  displayName: string;
  displayEmail: string;
  displayCode: string;
};

export default function ShareSettingsScreen() {
  const [settings, setSettings] = useState<ShareSettings>({
    shareWeeklySummariesWithCaregiver: true,
    shareSymptomTrendsWithCaregiver: true,
    shareMissedDoseAlertsWithCaregiver: true,
    shareClinicianReports: true,
  });

  const [saving, setSaving] = useState(false);

  const [me, setMe] = useState<MeResponse | null>(null);

  const [connections, setConnections] = useState<PatientConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [removingConnectionId, setRemovingConnectionId] = useState<string | null>(null);

  const [connectionCode, setConnectionCode] = useState("");
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    await Promise.all([loadMe(), loadSettings(), loadConnections()]);
  }

  async function loadMe() {
    try {
      const data = await apiFetch("/api/users/me");
      setMe(data);
    } catch {
      setMe(null);
    }
  }

  async function loadSettings() {
    try {
      const data = await apiFetch("/api/share-settings");
      setSettings({
        shareWeeklySummariesWithCaregiver: !!data.shareWeeklySummariesWithCaregiver,
        shareSymptomTrendsWithCaregiver: !!data.shareSymptomTrendsWithCaregiver,
        shareMissedDoseAlertsWithCaregiver: !!data.shareMissedDoseAlertsWithCaregiver,
        shareClinicianReports: !!data.shareClinicianReports,
      });
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to load share settings");
    }
  }

  async function loadConnections() {
    try {
      setConnectionsLoading(true);
      const data = await apiFetch("/api/connections/me");
      setConnections(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setConnections([]);
      Alert.alert("Error", e.message || "Failed to load connection data");
    } finally {
      setConnectionsLoading(false);
    }
  }

  async function save() {
    try {
      setSaving(true);
      await apiFetch("/api/share-settings", {
        method: "POST",
        body: JSON.stringify(settings),
      });
      Alert.alert("Saved", "Your share settings were updated.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function createConnectionRequest() {
    if (!connectionCode.trim()) {
      Alert.alert("Missing code", "Please enter a caregiver or clinician code.");
      return;
    }

    try {
      setConnecting(true);

      await apiFetch("/api/connections/request", {
        method: "POST",
        body: JSON.stringify({
          userCode: connectionCode.trim().toUpperCase(),
        }),
      });

      setConnectionCode("");
      await loadConnections();

      Alert.alert(
        "Request sent",
        "The connection request was sent. The other person must also accept before any data is shared."
      );
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to create connection request.");
    } finally {
      setConnecting(false);
    }
  }

  async function deleteConnection(connection: DisplayConnection) {
    try {
      setRemovingConnectionId(connection.id);

      await apiFetch(`/api/connections/${connection.id}`, {
        method: "DELETE",
      });

      await loadConnections();

      Alert.alert(
        "Connection removed",
        `${connection.displayName} has been removed from your ${
          connection.connectionType === "CAREGIVER" ? "caregiver" : "clinician"
        } connections.`
      );
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to remove connection.");
    } finally {
      setRemovingConnectionId(null);
    }
  }

  function confirmDeleteConnection(connection: DisplayConnection) {
    const roleLabel = connection.connectionType === "CAREGIVER" ? "caregiver" : "clinician";

    Alert.alert(
      "Remove connection?",
      `Are you sure you want to remove your connection with ${connection.displayName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirm removal",
              `This will stop sharing with this ${roleLabel}.`,
              [
                { text: "No", style: "cancel" },
                {
                  text: "Yes, remove",
                  style: "destructive",
                  onPress: () => deleteConnection(connection),
                },
              ]
            );
          },
        },
      ]
    );
  }

  function toggle<K extends keyof ShareSettings>(key: K) {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function getOtherParty(connection: PatientConnection) {
    const currentUserId = me?.id;

    const patientSideLooksLikeMe =
      !!currentUserId && !!connection.patientId && connection.patientId === currentUserId;

    const connectedSideLooksLikeMe =
      !!currentUserId &&
      !!connection.connectedUserId &&
      connection.connectedUserId === currentUserId;

    if (patientSideLooksLikeMe && !connectedSideLooksLikeMe) {
      return {
        name: connection.connectedUserName,
        email: connection.connectedUserEmail,
        code: connection.connectedUserCode,
      };
    }

    if (connectedSideLooksLikeMe && !patientSideLooksLikeMe) {
      return {
        name: connection.patientName,
        email: connection.patientEmail,
        code: connection.patientCode,
      };
    }

    return {
      name: connection.connectedUserName || connection.patientName,
      email: connection.connectedUserEmail || connection.patientEmail,
      code: connection.connectedUserCode || connection.patientCode,
    };
  }

  const normalizedConnections: DisplayConnection[] = useMemo(() => {
    return connections.map((connection) => {
      const other = getOtherParty(connection);

      return {
        ...connection,
        displayName:
          other.name ||
          other.email ||
          (connection.connectionType === "CAREGIVER" ? "Caregiver" : "Clinician"),
        displayEmail: other.email || "",
        displayCode: other.code || "",
      };
    });
  }, [connections, me]);

  const caregiverConnections = normalizedConnections.filter(
    (c) => c.connectionType === "CAREGIVER"
  );

  const clinicianConnections = normalizedConnections.filter(
    (c) => c.connectionType === "CLINICIAN"
  );

  function renderConnectionCard(connection: DisplayConnection) {
    const waitingOnOtherUser =
      !!connection.patientAccepted &&
      !connection.connectedUserAccepted &&
      connection.status === "PENDING";

    const isRemoving = removingConnectionId === connection.id;
    const showRemoveButton =
      connection.status === "PENDING" ||
      connection.status === "ACCEPTED" ||
      !!connection.fullyAccepted;

    return (
      <View key={connection.id} style={styles.connectionCard}>
        <Text style={styles.connectionName}>{connection.displayName}</Text>

        {!!connection.displayEmail && (
          <Text style={styles.connectionEmail}>{connection.displayEmail}</Text>
        )}

        {!!connection.displayCode && (
          <Text style={styles.connectionMeta}>Code: {connection.displayCode}</Text>
        )}

        <Text style={styles.connectionMeta}>
          {connection.connectionType === "CAREGIVER" ? "Caregiver" : "Clinician"} •{" "}
          {connection.status}
        </Text>

        <Text style={styles.connectionMeta}>
          You accepted: {connection.patientAccepted ? "Yes" : "No"}
        </Text>

        <Text style={styles.connectionMeta}>
          Other user accepted: {connection.connectedUserAccepted ? "Yes" : "No"}
        </Text>

        {!!connection.fullyAccepted ? (
          <Text style={styles.successText}>
            Connection active. Sharing is enabled.
          </Text>
        ) : waitingOnOtherUser ? (
          <Text style={styles.warningText}>
            Waiting for the other person to accept.
          </Text>
        ) : connection.status === "REJECTED" ? (
          <Text style={styles.warningText}>This request was rejected.</Text>
        ) : connection.status === "PENDING" ? (
          <Text style={styles.warningText}>Pending approval.</Text>
        ) : connection.status === "CANCELLED" ? (
          <Text style={styles.warningText}>This connection was cancelled.</Text>
        ) : null}

        {showRemoveButton && (
          <Pressable
            style={[styles.removeButton, isRemoving && styles.buttonDisabled]}
            onPress={() => confirmDeleteConnection(connection)}
            disabled={isRemoving}
          >
            <Text style={styles.removeButtonText}>
              {isRemoving ? "Removing..." : "Remove Connection"}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Sharing & Privacy</Text>
        <Text style={styles.subtitle}>
          Choose what caregivers and clinicians can view.
        </Text>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Connect Care Team</Text>
          <Text style={styles.helperText}>
            Add a caregiver or clinician code here. They will not see your information
            until both sides accept the connection.
          </Text>

          <Text style={styles.inputLabel}>Enter caregiver or clinician code</Text>
          <TextInput
            value={connectionCode}
            onChangeText={setConnectionCode}
            style={styles.input}
            placeholder="Example: AB12CD34"
            placeholderTextColor="#6B7280"
            autoCapitalize="characters"
          />

          <Pressable
            style={[styles.darkButton, connecting && styles.buttonDisabled]}
            onPress={createConnectionRequest}
            disabled={connecting}
          >
            <Text style={styles.darkButtonText}>
              {connecting ? "Sending..." : "Send Connection Request"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Current Caregiver Connections</Text>

          {connectionsLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
              <Text style={styles.emptyText}> Loading connections...</Text>
            </View>
          ) : caregiverConnections.length === 0 ? (
            <Text style={styles.emptyText}>No caregiver connections yet.</Text>
          ) : (
            caregiverConnections.map(renderConnectionCard)
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Current Clinician Connections</Text>

          {connectionsLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
              <Text style={styles.emptyText}> Loading connections...</Text>
            </View>
          ) : clinicianConnections.length === 0 ? (
            <Text style={styles.emptyText}>No clinician connections yet.</Text>
          ) : (
            clinicianConnections.map(renderConnectionCard)
          )}
        </View>

        {[
          ["Share weekly summaries with caregiver", "shareWeeklySummariesWithCaregiver"],
          ["Share symptom trends with caregiver", "shareSymptomTrendsWithCaregiver"],
          ["Share missed-dose alerts with caregiver", "shareMissedDoseAlertsWithCaregiver"],
          ["Share clinician reports", "shareClinicianReports"],
        ].map(([label, key]) => (
          <Pressable
            key={String(key)}
            style={styles.row}
            onPress={() => toggle(key as keyof ShareSettings)}
          >
            <Text style={styles.label}>{label}</Text>
            <View
              style={[
                styles.toggle,
                settings[key as keyof ShareSettings] && styles.toggleOn,
              ]}
            >
              <Text style={styles.toggleText}>
                {settings[key as keyof ShareSettings] ? "ON" : "OFF"}
              </Text>
            </View>
          </Pressable>
        ))}

        <Pressable
          style={[styles.saveButton, saving && styles.buttonDisabled]}
          onPress={save}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save Settings"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f8fb" },
  container: { padding: 20, gap: 16, paddingBottom: 36 },

  title: { fontSize: 28, fontWeight: "800", color: "#1f2a44" },
  subtitle: { fontSize: 15, color: "#5f6b85" },

  sectionCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2a44",
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: "#5f6b85",
    marginBottom: 12,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2a44",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f7f8fb",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111827",
    borderWidth: 1,
    borderColor: "#d8dee9",
  },

  darkButton: {
    marginTop: 12,
    backgroundColor: "#1f2a44",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  darkButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },

  connectionCard: {
    backgroundColor: "#f7f8fb",
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2a44",
  },
  connectionEmail: {
    fontSize: 14,
    color: "#5f6b85",
    marginTop: 4,
  },
  connectionMeta: {
    fontSize: 14,
    color: "#5f6b85",
    marginTop: 4,
  },
  successText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#15803d",
    marginTop: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#b45309",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#5f6b85",
  },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
  },

  removeButton: {
    marginTop: 12,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  removeButtonText: {
    color: "#b91c1c",
    fontSize: 15,
    fontWeight: "800",
  },

  row: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2a44",
    flex: 1,
    paddingRight: 12,
  },
  toggle: {
    minWidth: 68,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: "#ccd4e0",
  },
  toggleOn: { backgroundColor: "#5c7cfa" },
  toggleText: { color: "white", fontWeight: "800" },

  saveButton: {
    marginTop: 8,
    backgroundColor: "#1f2a44",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },

  buttonDisabled: {
    opacity: 0.6,
  },
});
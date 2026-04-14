package com.paul.paul_backend.service.impl;

import com.paul.paul_backend.dto.CaregiverAlertDTO;
import com.paul.paul_backend.dto.WeeklySummaryDTO;
import com.paul.paul_backend.model.ConnectionStatus;
import com.paul.paul_backend.model.ConnectionType;
import com.paul.paul_backend.model.Medication;
import com.paul.paul_backend.model.MedicationLog;
import com.paul.paul_backend.model.PatientConnection;
import com.paul.paul_backend.model.PatientShareSettings;
import com.paul.paul_backend.model.SymptomLog;
import com.paul.paul_backend.model.User;
import com.paul.paul_backend.repository.MedicationLogRepository;
import com.paul.paul_backend.repository.MedicationRepository;
import com.paul.paul_backend.repository.PatientConnectionRepository;
import com.paul.paul_backend.repository.PatientShareSettingsRepository;
import com.paul.paul_backend.repository.SymptomLogRepository;
import com.paul.paul_backend.repository.UserRepository;
import com.paul.paul_backend.service.CaregiverPatientService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CaregiverPatientServiceImpl implements CaregiverPatientService {

    private final PatientConnectionRepository patientConnectionRepository;
    private final PatientShareSettingsRepository patientShareSettingsRepository;
    private final UserRepository userRepository;
    private final MedicationRepository medicationRepository;
    private final MedicationLogRepository medicationLogRepository;
    private final SymptomLogRepository symptomLogRepository;

    @Override
    public User getConnectedPatient(String caregiverUserId) {
        PatientConnection connection = patientConnectionRepository
                .findFirstByConnectedUserIdAndConnectionTypeAndStatusAndPatientAcceptedTrueAndConnectedUserAcceptedTrue(
                        caregiverUserId,
                        ConnectionType.CAREGIVER,
                        ConnectionStatus.ACCEPTED
                )
                .orElseThrow(() -> new AccessDeniedException("No connected patient found for this caregiver."));

        return userRepository.findById(connection.getPatientId())
                .orElseThrow(() -> new IllegalArgumentException("Connected patient not found."));
    }

    @Override
    public List<Medication> getConnectedPatientMedications(String caregiverUserId) {
        User patient = getConnectedPatient(caregiverUserId);
        return medicationRepository.findByUserId(patient.getId());
    }

    @Override
    public List<MedicationLog> getConnectedPatientTodayLogs(String caregiverUserId) {
        User patient = getConnectedPatient(caregiverUserId);

        List<MedicationLog> allLogs = medicationLogRepository.findByUserId(patient.getId());
        LocalDate today = LocalDate.now();

        return allLogs.stream()
                .filter(log -> log.getTimestamp() != null)
                .filter(log -> log.getTimestamp()
                        .atZone(ZoneId.systemDefault())
                        .toLocalDate()
                        .equals(today))
                .sorted((a, b) -> {
                    Instant at = a.getTimestamp() == null ? Instant.EPOCH : a.getTimestamp();
                    Instant bt = b.getTimestamp() == null ? Instant.EPOCH : b.getTimestamp();
                    return bt.compareTo(at);
                })
                .toList();
    }

    @Override
    public WeeklySummaryDTO getSharedWeeklySummary(String caregiverUserId) {
        User patient = getConnectedPatient(caregiverUserId);

        PatientShareSettings settings = patientShareSettingsRepository
                .findByPatientId(patient.getId())
                .orElse(PatientShareSettings.builder()
                        .patientId(patient.getId())
                        .shareWeeklySummariesWithCaregiver(true)
                        .shareSymptomTrendsWithCaregiver(true)
                        .shareMissedDoseAlertsWithCaregiver(true)
                        .build());

        if (!settings.isShareWeeklySummariesWithCaregiver()) {
            throw new AccessDeniedException("This patient is not sharing weekly summaries with the caregiver.");
        }

        List<MedicationLog> logs = medicationLogRepository.findByUserId(patient.getId());

        LocalDate today = LocalDate.now();
        LocalDate start = today.minusDays(6);

        int taken = 0;
        int missed = 0;

        for (MedicationLog log : logs) {
            if (log.getTimestamp() == null) continue;

            LocalDate logDate = log.getTimestamp()
                    .atZone(ZoneId.systemDefault())
                    .toLocalDate();

            if (logDate.isBefore(start) || logDate.isAfter(today)) continue;

            if ("TAKEN".equalsIgnoreCase(String.valueOf(log.getStatus()))) taken++;
            if ("MISSED".equalsIgnoreCase(String.valueOf(log.getStatus()))) missed++;
        }

        return WeeklySummaryDTO.builder()
                .takenDoses(taken)
                .missedDoses(missed)
                .build();
    }

    @Override
    public List<SymptomLog> getSharedSymptomTrends(String caregiverUserId) {
        User patient = getConnectedPatient(caregiverUserId);

        PatientShareSettings settings = patientShareSettingsRepository
                .findByPatientId(patient.getId())
                .orElse(PatientShareSettings.builder()
                        .patientId(patient.getId())
                        .shareWeeklySummariesWithCaregiver(true)
                        .shareSymptomTrendsWithCaregiver(true)
                        .shareMissedDoseAlertsWithCaregiver(true)
                        .build());

        if (!settings.isShareSymptomTrendsWithCaregiver()) {
            throw new AccessDeniedException("This patient is not sharing symptom trends with the caregiver.");
        }

        return symptomLogRepository.findByUserIdOrderByCreatedAtDesc(patient.getId());
    }

    @Override
    public List<CaregiverAlertDTO> getCaregiverAlerts(String caregiverUserId) {
        User patient = getConnectedPatient(caregiverUserId);

        PatientShareSettings settings = patientShareSettingsRepository
                .findByPatientId(patient.getId())
                .orElse(PatientShareSettings.builder()
                        .patientId(patient.getId())
                        .shareWeeklySummariesWithCaregiver(true)
                        .shareSymptomTrendsWithCaregiver(true)
                        .shareMissedDoseAlertsWithCaregiver(true)
                        .build());

        List<CaregiverAlertDTO> alerts = new ArrayList<>();

        // Missed medication alerts
        if (settings.isShareMissedDoseAlertsWithCaregiver()) {
            List<MedicationLog> todayLogs = getConnectedPatientTodayLogs(caregiverUserId);

            for (MedicationLog log : todayLogs) {
                if (!"MISSED".equalsIgnoreCase(String.valueOf(log.getStatus()))) {
                    continue;
                }

                String createdAt = log.getTimestamp() != null
                        ? log.getTimestamp().toString()
                        : Instant.now().toString();

                alerts.add(CaregiverAlertDTO.builder()
                        .type("MISSED_DOSE")
                        .title("Missed medication")
                        .message(patient.getName() + " missed a scheduled medication dose.")
                        .createdAt(createdAt)
                        .build());
            }
        }

        // High-severity bad symptom alerts
        if (settings.isShareSymptomTrendsWithCaregiver()) {
            List<SymptomLog> symptomLogs = symptomLogRepository.findByUserIdOrderByCreatedAtDesc(patient.getId());

            for (SymptomLog log : symptomLogs) {
                if (!shouldAlertCaregiverForSymptom(log)) {
                    continue;
                }

                String symptomName = log.getSymptomName() != null && !log.getSymptomName().isBlank()
                        ? log.getSymptomName()
                        : "a symptom";

                String category = log.getCategory() != null && !log.getCategory().isBlank()
                        ? log.getCategory()
                        : "BAD";

                String createdAt = log.getCreatedAt() != null
                        ? log.getCreatedAt().toString()
                        : Instant.now().toString();

                alerts.add(CaregiverAlertDTO.builder()
                        .type("HIGH_SYMPTOM")
                        .title("High symptom alert")
                        .message(
                                patient.getName() + " logged " + symptomName +
                                        " in category " + category +
                                        " with severity " + log.getSeverity() + "/10."
                        )
                        .createdAt(createdAt)
                        .build());
            }
        }

        alerts.sort((a, b) -> {
            Instant at = parseInstantOrEpoch(a.getCreatedAt());
            Instant bt = parseInstantOrEpoch(b.getCreatedAt());
            return bt.compareTo(at);
        });

        return alerts;
    }

    @Override
    public String getTrendGuidance(String caregiverUserId) {
        List<SymptomLog> symptoms = getSharedSymptomTrends(caregiverUserId);

        long badCount = symptoms.stream()
                .filter(s -> s.getFeeling() != null && "BAD".equalsIgnoreCase(s.getFeeling().name()))
                .count();

        if (badCount == 0) {
            return "No concerning symptom trends right now.";
        }

        if (badCount < 3) {
            return "There are a few bad symptom entries. Keep monitoring for changes.";
        }

        return "There is a repeated bad symptom trend. Continue monitoring closely.";
    }

    @Override
    public void sendMedicationReminder(
            String caregiverUserId,
            String medicationId,
            String scheduledTime,
            String message
    ) {
        User patient = getConnectedPatient(caregiverUserId);

        // Keep your existing push-notification sending logic here if you already have it.
        // This method is already being called by /api/caregiver/patient/reminders.
        System.out.println("Send reminder to patient " + patient.getId()
                + " for medication " + medicationId
                + " at " + scheduledTime
                + " with message: " + message);
    }

    private boolean shouldAlertCaregiverForSymptom(SymptomLog log) {
        if (log == null) return false;

        boolean severityHigh = log.getSeverity() > 5;

        boolean badFeeling =
                log.getFeeling() != null &&
                        "BAD".equalsIgnoreCase(log.getFeeling().name());

        boolean badCategory =
                log.getCategory() != null &&
                        !log.getCategory().isBlank() &&
                        (
                                "BAD".equalsIgnoreCase(log.getCategory()) ||
                                        "SEVERE".equalsIgnoreCase(log.getCategory()) ||
                                        "URGENT".equalsIgnoreCase(log.getCategory()) ||
                                        "CONCERNING".equalsIgnoreCase(log.getCategory())
                        );

        return severityHigh && (badFeeling || badCategory);
    }

    private Instant parseInstantOrEpoch(String value) {
        try {
            return value != null ? Instant.parse(value) : Instant.EPOCH;
        } catch (Exception e) {
            return Instant.EPOCH;
        }
    }
}
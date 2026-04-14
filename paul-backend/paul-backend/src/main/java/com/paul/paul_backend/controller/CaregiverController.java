package com.paul.paul_backend.controller;

import com.paul.paul_backend.dto.CaregiverAlertDTO;
import com.paul.paul_backend.dto.WeeklySummaryDTO;
import com.paul.paul_backend.model.Medication;
import com.paul.paul_backend.model.MedicationLog;
import com.paul.paul_backend.model.SymptomLog;
import com.paul.paul_backend.model.User;
import com.paul.paul_backend.security.AuthUtil;
import com.paul.paul_backend.service.CaregiverPatientService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/caregiver")
@RequiredArgsConstructor
public class CaregiverController {

    private final CaregiverPatientService caregiverPatientService;

    @GetMapping("/patient")
    public PatientProfileResponse getConnectedPatient() {
        User patient = caregiverPatientService.getConnectedPatient(AuthUtil.currentUserId());

        return new PatientProfileResponse(
                patient.getId(),
                patient.getName(),
                patient.getEmail(),
                patient.getUserCode()
        );
    }

    @GetMapping("/patient/medications")
    public List<Medication> getConnectedPatientMedications() {
        return caregiverPatientService.getConnectedPatientMedications(AuthUtil.currentUserId());
    }

    @GetMapping("/patient/medication-logs/today")
    public List<MedicationLog> getConnectedPatientTodayLogs() {
        return caregiverPatientService.getConnectedPatientTodayLogs(AuthUtil.currentUserId());
    }

    @GetMapping("/patient/weekly-summary")
    public WeeklySummaryDTO getSharedWeeklySummary() {
        return caregiverPatientService.getSharedWeeklySummary(AuthUtil.currentUserId());
    }

    @GetMapping("/patient/symptoms")
    public List<SymptomLog> getSharedSymptoms() {
        return caregiverPatientService.getSharedSymptomTrends(AuthUtil.currentUserId());
    }

    @GetMapping("/alerts")
    public List<CaregiverAlertDTO> getAlerts() {
        return caregiverPatientService.getCaregiverAlerts(AuthUtil.currentUserId());
    }

    @GetMapping("/guidance")
    public String getGuidance() {
        return caregiverPatientService.getTrendGuidance(AuthUtil.currentUserId());
    }

    @PostMapping("/patient/reminders")
    public ResponseEntity<String> sendMedicationReminder(
            @RequestBody CaregiverReminderRequest request
    ) {
        caregiverPatientService.sendMedicationReminder(
                AuthUtil.currentUserId(),
                request.getMedicationId(),
                request.getScheduledTime(),
                request.getMessage()
        );

        return ResponseEntity.ok("Reminder sent successfully.");
    }

    @Data
    @AllArgsConstructor
    static class PatientProfileResponse {
        private String id;
        private String name;
        private String email;
        private String userCode;
    }

    @Data
    static class CaregiverReminderRequest {
        private String medicationId;
        private String scheduledTime;
        private String message;
    }
}
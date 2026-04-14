package com.paul.paul_backend.service;

import com.paul.paul_backend.dto.CaregiverAlertDTO;
import com.paul.paul_backend.dto.WeeklySummaryDTO;
import com.paul.paul_backend.model.Medication;
import com.paul.paul_backend.model.MedicationLog;
import com.paul.paul_backend.model.SymptomLog;
import com.paul.paul_backend.model.User;

import java.util.List;

public interface CaregiverPatientService {

    User getConnectedPatient(String caregiverId);

    List<Medication> getConnectedPatientMedications(String caregiverId);

    List<MedicationLog> getConnectedPatientTodayLogs(String caregiverId);

    WeeklySummaryDTO getSharedWeeklySummary(String caregiverId);

    List<SymptomLog> getSharedSymptomTrends(String caregiverId);

    List<CaregiverAlertDTO> getCaregiverAlerts(String caregiverId);

    String getTrendGuidance(String caregiverId);

    void sendMedicationReminder(
            String caregiverId,
            String medicationId,
            String scheduledTime,
            String message
    );
}
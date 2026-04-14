package com.paul.paul_backend.service;

import com.paul.paul_backend.dto.DoseLogRequest;
import com.paul.paul_backend.dto.UpdateMedicationLogRequest;
import com.paul.paul_backend.model.DoseStatus;
import com.paul.paul_backend.model.MedicationLog;
import com.paul.paul_backend.repository.MedicationLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MedicationLogService {

    private final MedicationLogRepository logRepository;

    public MedicationLog logDose(String userId, DoseLogRequest req) {
        DoseStatus status = parseStatus(req.getStatus());

        MedicationLog log = MedicationLog.builder()
                .userId(userId)
                .medicationId(req.getMedicationId())
                .scheduledTime(req.getScheduledTime())
                .status(status)
                .timestamp(Instant.now())
                .build();

        return logRepository.save(log);
    }

    public List<MedicationLog> logsForMedication(String userId, String medicationId) {
        return logRepository.findByUserIdAndMedicationIdOrderByTimestampDesc(userId, medicationId);
    }

    public MedicationLog updateLog(String userId, String logId, UpdateMedicationLogRequest req) {
        MedicationLog log = logRepository.findByIdAndUserId(logId, userId)
                .orElseThrow(() -> new RuntimeException("Medication log not found"));

        if (req.getStatus() != null && !req.getStatus().isBlank()) {
            log.setStatus(parseStatus(req.getStatus()));
        }

        if (req.getTimestamp() != null) {
            log.setTimestamp(req.getTimestamp());
        }

        if (req.getScheduledTime() != null && !req.getScheduledTime().isBlank()) {
            log.setScheduledTime(req.getScheduledTime());
        }

        return logRepository.save(log);
    }

    public void deleteLogsForMedication(String userId, String medicationId) {
        logRepository.deleteByUserIdAndMedicationId(userId, medicationId);
    }

    private DoseStatus parseStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new RuntimeException("Log status is required");
        }

        try {
            return DoseStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid log status");
        }
    }

    public List<MedicationLog> logsForConnectedPatientMedication(
            String caregiverUserId,
            String patientUserId,
            String medicationId
    ) {
        // verify caregiverUserId is connected to patientUserId before returning logs
        // example:
        // if (!patientConnectionService.canViewPatient(caregiverUserId, patientUserId)) {
        //     throw new RuntimeException("Not authorized to view this patient's medication logs.");
        // }

        return logRepository
                .findByUserIdAndMedicationIdOrderByTimestampDesc(patientUserId, medicationId);
    }
}
package com.paul.paul_backend.service;

import com.paul.paul_backend.dto.DoseLogRequest;
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
        MedicationLog log = MedicationLog.builder()
                .userId(userId)
                .medicationId(req.getMedicationId())
                .scheduledTime(req.getScheduledTime())
                .status(req.getStatus())
                .timestamp(Instant.now())
                .build();

        return logRepository.save(log);
    }

    public List<MedicationLog> logsForMedication(String userId, String medicationId) {
        return logRepository.findByUserIdAndMedicationId(userId, medicationId);
    }
}
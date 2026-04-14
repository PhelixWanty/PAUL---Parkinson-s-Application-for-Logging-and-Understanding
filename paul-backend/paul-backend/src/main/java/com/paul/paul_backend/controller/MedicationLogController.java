package com.paul.paul_backend.controller;

import com.paul.paul_backend.dto.DoseLogRequest;
import com.paul.paul_backend.dto.UpdateMedicationLogRequest;
import com.paul.paul_backend.model.MedicationLog;
import com.paul.paul_backend.security.AuthUtil;
import com.paul.paul_backend.service.MedicationLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/medication-logs")
@RequiredArgsConstructor
public class MedicationLogController {

    private final MedicationLogService logService;

    @PostMapping
    public MedicationLog logDose(@RequestBody DoseLogRequest req) {
        String userId = AuthUtil.currentUserId();
        return logService.logDose(userId, req);
    }

    @GetMapping("/medication/{medicationId}")
    public List<MedicationLog> logsForMedication(@PathVariable String medicationId) {
        String userId = AuthUtil.currentUserId();
        return logService.logsForMedication(userId, medicationId);
    }

    @GetMapping("/patient/{patientUserId}/medication/{medicationId}")
    public List<MedicationLog> logsForConnectedPatientMedication(
            @PathVariable String patientUserId,
            @PathVariable String medicationId
    ) {
        String caregiverUserId = AuthUtil.currentUserId();
        return logService.logsForConnectedPatientMedication(
                caregiverUserId,
                patientUserId,
                medicationId
        );
    }

    @PutMapping("/{logId}")
    public MedicationLog updateLog(
            @PathVariable String logId,
            @RequestBody UpdateMedicationLogRequest req
    ) {
        String userId = AuthUtil.currentUserId();
        return logService.updateLog(userId, logId, req);
    }
}
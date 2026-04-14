package com.paul.paul_backend.controller;

import com.paul.paul_backend.model.PatientShareSettings;
import com.paul.paul_backend.repository.PatientShareSettingsRepository;
import com.paul.paul_backend.security.AuthUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/share-settings")
@RequiredArgsConstructor
public class PatientShareSettingsController {

    private final PatientShareSettingsRepository repository;

    @GetMapping
    public PatientShareSettings getSettings() {
        String userId = AuthUtil.currentUserId();

        return repository.findByPatientId(userId)
                .orElse(PatientShareSettings.builder()
                        .patientId(userId)
                        .build());
    }

    @PostMapping
    public PatientShareSettings save(@RequestBody PatientShareSettings incoming) {
        String userId = AuthUtil.currentUserId();

        PatientShareSettings current = repository.findByPatientId(userId)
                .orElse(PatientShareSettings.builder()
                        .patientId(userId)
                        .build());

        current.setShareWeeklySummariesWithCaregiver(incoming.isShareWeeklySummariesWithCaregiver());
        current.setShareSymptomTrendsWithCaregiver(incoming.isShareSymptomTrendsWithCaregiver());
        current.setShareMissedDoseAlertsWithCaregiver(incoming.isShareMissedDoseAlertsWithCaregiver());
        current.setShareClinicianReports(incoming.isShareClinicianReports());

        return repository.save(current);
    }
}
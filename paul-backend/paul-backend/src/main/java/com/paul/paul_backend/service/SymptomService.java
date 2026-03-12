// src/main/java/com/paul/paul_backend/service/SymptomService.java
package com.paul.paul_backend.service;

import com.paul.paul_backend.dto.SymptomLogRequest;
import com.paul.paul_backend.model.SymptomLog;
import com.paul.paul_backend.repository.SymptomLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SymptomService {

    private final SymptomLogRepository repository;

    public SymptomLog create(String userId, SymptomLogRequest req) {
        if (req.getSymptomName() == null || req.getSymptomName().trim().isEmpty()) {
            throw new IllegalArgumentException("Symptom name is required");
        }
        if (req.getCategory() == null || req.getCategory().trim().isEmpty()) {
            throw new IllegalArgumentException("Category is required (MOTOR, NON_MOTOR, CUSTOM)");
        }
        if (req.getSeverity() < 1 || req.getSeverity() > 10) {
            throw new IllegalArgumentException("Severity must be between 1 and 10");
        }
        if (req.getDurationMinutes() < 0) {
            throw new IllegalArgumentException("Duration must be 0 or more minutes");
        }

        SymptomLog log = SymptomLog.builder()
                .userId(userId)
                .category(req.getCategory().trim())
                .symptomName(req.getSymptomName().trim())
                .severity(req.getSeverity())
                .durationMinutes(req.getDurationMinutes())
                .note(req.getNote())
                .createdAt(Instant.now())
                .build();

        return repository.save(log);
    }

    public List<SymptomLog> list(String userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId);
    }
}
package com.paul.paul_backend.repository;

import com.paul.paul_backend.model.PatientShareSettings;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface PatientShareSettingsRepository extends MongoRepository<PatientShareSettings, String> {
    Optional<PatientShareSettings> findByPatientId(String patientId);
}
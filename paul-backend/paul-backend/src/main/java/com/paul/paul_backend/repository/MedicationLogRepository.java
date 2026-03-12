package com.paul.paul_backend.repository;

import com.paul.paul_backend.model.MedicationLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface MedicationLogRepository extends MongoRepository<MedicationLog, String> {
    List<MedicationLog> findByUserIdAndMedicationId(String userId, String medicationId);
    List<MedicationLog> findByUserIdAndTimestampBetween(String userId, Instant start, Instant end);
}
package com.paul.paul_backend.repository;

import com.paul.paul_backend.model.DoseStatus;
import com.paul.paul_backend.model.MedicationLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface MedicationLogRepository extends MongoRepository<MedicationLog, String> {

    List<MedicationLog> findByUserIdAndMedicationIdOrderByTimestampDesc(String userId, String medicationId);

    List<MedicationLog> findByUserIdAndTimestampBetween(String userId, Instant start, Instant end);

    boolean existsByUserIdAndMedicationIdAndScheduledTimeAndStatusAndTimestampBetween(
            String userId,
            String medicationId,
            String scheduledTime,
            DoseStatus status,
            Instant start,
            Instant end
    );
}
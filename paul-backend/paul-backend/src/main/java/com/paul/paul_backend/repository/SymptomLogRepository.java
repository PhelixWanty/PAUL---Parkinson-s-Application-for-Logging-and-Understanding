// src/main/java/com/paul/paul_backend/repository/SymptomLogRepository.java
package com.paul.paul_backend.repository;

import com.paul.paul_backend.model.SymptomLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SymptomLogRepository extends MongoRepository<SymptomLog, String> {
    List<SymptomLog> findByUserIdOrderByCreatedAtDesc(String userId);
    List<SymptomLog> findByUserId(String userId);
    Optional<SymptomLog> findByIdAndUserId(String id, String userId);
}
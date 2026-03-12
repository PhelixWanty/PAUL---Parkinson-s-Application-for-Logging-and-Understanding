package com.paul.paul_backend.repository;

import com.paul.paul_backend.model.Medication;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface MedicationRepository extends MongoRepository<Medication, String> {
    List<Medication> findByUserId(String userId);
    Optional<Medication> findByIdAndUserId(String id, String userId);
}
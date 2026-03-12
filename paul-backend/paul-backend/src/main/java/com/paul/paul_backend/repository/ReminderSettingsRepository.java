package com.paul.paul_backend.repository;

import com.paul.paul_backend.model.ReminderSettings;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ReminderSettingsRepository extends MongoRepository<ReminderSettings, String> {
    Optional<ReminderSettings> findByUserId(String userId);
}
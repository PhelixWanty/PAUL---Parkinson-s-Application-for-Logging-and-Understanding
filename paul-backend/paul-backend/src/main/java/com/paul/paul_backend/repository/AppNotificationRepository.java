package com.paul.paul_backend.repository;

import com.paul.paul_backend.model.AppNotification;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AppNotificationRepository extends MongoRepository<AppNotification, String> {
}
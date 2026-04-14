package com.paul.paul_backend.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppNotification {

    @Id
    private String id;

    private String userId;
    private String title;
    private String message;
    private String type;
    private String relatedMedicationId;
    private String scheduledTime;
    private boolean read;
    private Instant createdAt;
}
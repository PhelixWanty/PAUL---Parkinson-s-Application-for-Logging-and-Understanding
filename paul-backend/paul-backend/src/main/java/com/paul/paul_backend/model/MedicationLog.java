package com.paul.paul_backend.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "medication_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MedicationLog {
    @Id
    private String id;

    private String userId;
    private String medicationId;

    // scheduled time for the dose (string "08:00")
    private String scheduledTime;

    // status
    private DoseStatus status; // TAKEN, MISSED, SKIPPED

    private Instant timestamp; // when user confirmed or system marked missed
}
// src/main/java/com/paul/paul_backend/model/SymptomLog.java
package com.paul.paul_backend.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "symptom_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SymptomLog {

    @Id
    private String id;

    private String userId;

    private String category; // MOTOR, NON_MOTOR, CUSTOM

    private String symptomName;

    private int severity; // 1–10

    private int durationMinutes;

    private String note;

    private Instant createdAt;
}
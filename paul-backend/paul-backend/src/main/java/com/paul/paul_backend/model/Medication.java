package com.paul.paul_backend.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "medications")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Medication {
    @Id
    private String id;

    // Owner (patient) - store userId to keep it secure
    private String userId;

    private String name;
    private String dosage;       // "10mg", "1 tablet"
    private String instructions; // "With food", "Before bed"

    // Daily schedule times (simple MVP)
    @Builder.Default
    private List<String> times = new ArrayList<>(); // store "08:00", "14:00"

    private boolean active; // allow disabling meds without deleting
}
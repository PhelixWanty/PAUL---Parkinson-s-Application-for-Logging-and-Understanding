// src/main/java/com/paul/paul_backend/dto/SymptomLogRequest.java
package com.paul.paul_backend.dto;

import lombok.Data;

@Data
public class SymptomLogRequest {
    private String category;        // MOTOR, NON_MOTOR, CUSTOM
    private String symptomName;     // "Tremor" or custom text
    private int severity;           // 1-10
    private int durationMinutes;    // minutes
    private String note;            // optional
}
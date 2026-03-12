package com.paul.paul_backend.dto;

import com.paul.paul_backend.model.DoseStatus;
import lombok.Data;

@Data
public class DoseLogRequest {
    private String medicationId;
    private String scheduledTime;
    private DoseStatus status; // TAKEN / MISSED / SKIPPED
}
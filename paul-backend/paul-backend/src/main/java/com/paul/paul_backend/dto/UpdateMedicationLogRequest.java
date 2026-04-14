package com.paul.paul_backend.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
public class UpdateMedicationLogRequest {
    private String status;
    private String scheduledTime;
    private Instant timestamp;
}
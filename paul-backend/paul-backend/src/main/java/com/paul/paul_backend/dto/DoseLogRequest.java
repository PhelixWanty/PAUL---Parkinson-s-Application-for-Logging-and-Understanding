package com.paul.paul_backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DoseLogRequest {
    private String medicationId;
    private String scheduledTime;
    private String status;
}
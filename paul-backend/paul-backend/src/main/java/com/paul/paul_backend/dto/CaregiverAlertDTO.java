package com.paul.paul_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@AllArgsConstructor
@Builder
public class CaregiverAlertDTO {
    private String type;
    private String title;
    private String message;
    private String createdAt;
}
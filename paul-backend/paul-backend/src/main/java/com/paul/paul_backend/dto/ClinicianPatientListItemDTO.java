package com.paul.paul_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClinicianPatientListItemDTO {
    private String patientId;
    private String patientName;
    private String email;
    private String userCode;
}
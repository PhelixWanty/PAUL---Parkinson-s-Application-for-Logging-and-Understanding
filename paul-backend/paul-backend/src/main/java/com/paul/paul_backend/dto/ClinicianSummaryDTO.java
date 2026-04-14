package com.paul.paul_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClinicianSummaryDTO {
    private String patientId;
    private String patientName;

    private int connectedPatientCount;
    private int medicationCount;
    private int symptomLogCount;

    private int adherencePercent;
    private int symptomCountLast30Days;
    private double avgSeverityLast30Days;
    private String patternNote;
}
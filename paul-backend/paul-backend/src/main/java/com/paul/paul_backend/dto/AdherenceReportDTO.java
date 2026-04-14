package com.paul.paul_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdherenceReportDTO {
    private String patientId;
    private String patientName;

    private int expectedDoses;
    private int takenDoses;
    private int missedDoses;
    private int adherencePercent;

    private int medicationCount;

    private List<TrendPointDTO> dailyTrend;
}
package com.paul.paul_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
@Builder
public class WeeklySummaryDTO {
    private int expectedDoses;
    private int takenDoses;
    private int missedDoses;
    private int skippedDoses;
    private int adherencePercent;

    private int symptomCount;
    private double avgSeverity;

    private List<TrendPointDTO> medicationTrend;
    private List<TrendPointDTO> symptomTrend;

    private String insight;
}
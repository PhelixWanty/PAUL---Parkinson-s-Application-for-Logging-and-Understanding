package com.paul.paul_backend.service;

import com.paul.paul_backend.dto.TrendPointDTO;
import com.paul.paul_backend.dto.WeeklySummaryDTO;
import com.paul.paul_backend.model.DoseStatus;
import com.paul.paul_backend.model.Medication;
import com.paul.paul_backend.model.MedicationLog;
import com.paul.paul_backend.model.SymptomLog;
import com.paul.paul_backend.repository.MedicationLogRepository;
import com.paul.paul_backend.repository.MedicationRepository;
import com.paul.paul_backend.repository.SymptomLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SummaryService {

    private final MedicationRepository medicationRepository;
    private final MedicationLogRepository medicationLogRepository;
    private final SymptomLogRepository symptomLogRepository;

    public WeeklySummaryDTO getWeeklySummary(String userId) {
        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.now(zone);

        Instant start = today.minusDays(6).atStartOfDay(zone).toInstant();
        Instant end = today.plusDays(1).atStartOfDay(zone).toInstant();

        List<Medication> meds = medicationRepository.findByUserId(userId);
        List<MedicationLog> logs = medicationLogRepository.findByUserIdAndTimestampBetween(userId, start, end);

        List<SymptomLog> symptoms = symptomLogRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .filter(s -> s.getCreatedAt() != null)
                .filter(s -> !s.getCreatedAt().isBefore(start) && s.getCreatedAt().isBefore(end))
                .toList();

        int expected = meds.stream()
                .mapToInt(m -> m.getTimes() == null ? 0 : m.getTimes().size() * 7)
                .sum();

        int taken = (int) logs.stream().filter(l -> l.getStatus() == DoseStatus.TAKEN).count();
        int missed = (int) logs.stream().filter(l -> l.getStatus() == DoseStatus.MISSED).count();
        int skipped = (int) logs.stream().filter(l -> l.getStatus() == DoseStatus.SKIPPED).count();

        int adherence = expected <= 0 ? 0 : (int) Math.round((taken * 100.0) / expected);

        double avgSeverity = symptoms.isEmpty()
                ? 0.0
                : symptoms.stream().mapToInt(SymptomLog::getSeverity).average().orElse(0.0);

        List<TrendPointDTO> medicationTrend = buildMedicationTrend(logs, zone);
        List<TrendPointDTO> symptomTrend = buildSymptomTrend(symptoms, zone);

        String insight = buildInsight(adherence, avgSeverity, missed);

        return WeeklySummaryDTO.builder()
                .expectedDoses(expected)
                .takenDoses(taken)
                .missedDoses(missed)
                .skippedDoses(skipped)
                .adherencePercent(adherence)
                .symptomCount(symptoms.size())
                .avgSeverity(avgSeverity)
                .medicationTrend(medicationTrend)
                .symptomTrend(symptomTrend)
                .insight(insight)
                .build();
    }

    private List<TrendPointDTO> buildMedicationTrend(List<MedicationLog> logs, ZoneId zone) {
        List<TrendPointDTO> points = new ArrayList<>();

        for (int i = 6; i >= 0; i--) {
            LocalDate date = LocalDate.now(zone).minusDays(i);

            int taken = (int) logs.stream()
                    .filter(l -> l.getTimestamp() != null)
                    .filter(l -> l.getTimestamp().atZone(zone).toLocalDate().equals(date))
                    .filter(l -> l.getStatus() == DoseStatus.TAKEN)
                    .count();

            points.add(new TrendPointDTO(date.getDayOfWeek().name().substring(0, 3), taken));
        }

        return points;
    }

    private List<TrendPointDTO> buildSymptomTrend(List<SymptomLog> logs, ZoneId zone) {
        List<TrendPointDTO> points = new ArrayList<>();

        for (int i = 6; i >= 0; i--) {
            LocalDate date = LocalDate.now(zone).minusDays(i);

            int count = (int) logs.stream()
                    .filter(l -> l.getCreatedAt() != null)
                    .filter(l -> l.getCreatedAt().atZone(zone).toLocalDate().equals(date))
                    .count();

            points.add(new TrendPointDTO(date.getDayOfWeek().name().substring(0, 3), count));
        }

        return points;
    }

    private String buildInsight(int adherence, double avgSeverity, int missed) {
        if (missed >= 3) {
            return "Several doses were missed this week. A steadier routine may help.";
        }

        if (adherence >= 85 && avgSeverity <= 4) {
            return "Medication adherence was strong this week and symptoms were relatively stable.";
        }

        if (avgSeverity >= 7) {
            return "Symptoms were more intense this week. Consider sharing this summary with a caregiver or clinician.";
        }

        return "This week shows mixed patterns. Keep tracking to spot trends over time.";
    }
}
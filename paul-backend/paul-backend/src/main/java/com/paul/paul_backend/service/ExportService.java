package com.paul.paul_backend.service;

import com.paul.paul_backend.dto.AdherenceReportDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ExportService {

    public String adherenceReportToCsv(AdherenceReportDTO report) {
        StringBuilder sb = new StringBuilder();

        sb.append("Patient ID,Patient Name,Expected Doses,Taken Doses,Missed Doses,Adherence Percent\n");
        sb.append(csv(report.getPatientId())).append(",")
                .append(csv(report.getPatientName())).append(",")
                .append(report.getExpectedDoses()).append(",")
                .append(report.getTakenDoses()).append(",")
                .append(report.getMissedDoses()).append(",")
                .append(report.getAdherencePercent()).append("\n");

        return sb.toString();
    }

    private String csv(String value) {
        if (value == null) return "";
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
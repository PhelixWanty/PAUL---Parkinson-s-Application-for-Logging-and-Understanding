package com.paul.paul_backend.controller;

import com.paul.paul_backend.dto.AdherenceReportDTO;
import com.paul.paul_backend.security.AuthUtil;
import com.paul.paul_backend.service.ClinicianPatientService;
import com.paul.paul_backend.service.ExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ClinicianPatientService clinicianPatientService;
    private final ExportService exportService;

    @GetMapping("/adherence.csv")
    public ResponseEntity<String> exportAdherenceCsv() {
        AdherenceReportDTO report = clinicianPatientService.getAdherenceReport(AuthUtil.currentUserId());
        String csv = exportService.adherenceReportToCsv(report);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=adherence-report.csv")
                .contentType(MediaType.TEXT_PLAIN)
                .body(csv);
    }
}
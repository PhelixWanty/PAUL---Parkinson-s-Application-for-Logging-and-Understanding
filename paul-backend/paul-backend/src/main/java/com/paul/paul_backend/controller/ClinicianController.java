package com.paul.paul_backend.controller;

import com.paul.paul_backend.dto.AdherenceReportDTO;
import com.paul.paul_backend.dto.ClinicianPatientListItemDTO;
import com.paul.paul_backend.dto.ClinicianSummaryDTO;
import com.paul.paul_backend.model.Medication;
import com.paul.paul_backend.model.SymptomLog;
import com.paul.paul_backend.security.AuthUtil;
import com.paul.paul_backend.service.ClinicianPatientService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clinician")
@RequiredArgsConstructor
public class ClinicianController {

    private final ClinicianPatientService clinicianPatientService;

    @GetMapping("/patients")
    public List<ClinicianPatientListItemDTO> getConnectedPatients() {
        return clinicianPatientService.getConnectedPatients(AuthUtil.currentUserId());
    }

    @GetMapping("/patient/adherence-report")
    public AdherenceReportDTO adherenceReport() {
        return clinicianPatientService.getAdherenceReport(AuthUtil.currentUserId());
    }

    @GetMapping("/patient/symptoms")
    public List<SymptomLog> symptomTrends() {
        return clinicianPatientService.getSymptomTrends(AuthUtil.currentUserId());
    }

    @GetMapping("/patient/summary")
    public ClinicianSummaryDTO clinicianSummary() {
        return clinicianPatientService.getClinicianSummary(AuthUtil.currentUserId());
    }

    @GetMapping("/patients/{patientId}/medications")
    public List<Medication> getPatientMedications(@PathVariable String patientId) {
        return clinicianPatientService.getPatientMedicationsForClinician(
                AuthUtil.currentUserId(),
                patientId
        );
    }

    @GetMapping("/patients/{patientId}/symptoms")
    public List<SymptomLog> getPatientSymptoms(@PathVariable String patientId) {
        return clinicianPatientService.getPatientSymptomsForClinician(
                AuthUtil.currentUserId(),
                patientId
        );
    }
}
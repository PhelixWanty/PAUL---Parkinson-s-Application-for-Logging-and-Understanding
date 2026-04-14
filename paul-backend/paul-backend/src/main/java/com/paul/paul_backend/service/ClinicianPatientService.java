package com.paul.paul_backend.service;

import com.paul.paul_backend.dto.AdherenceReportDTO;
import com.paul.paul_backend.dto.ClinicianPatientListItemDTO;
import com.paul.paul_backend.dto.ClinicianSummaryDTO;
import com.paul.paul_backend.model.Medication;
import com.paul.paul_backend.model.SymptomLog;

import java.util.List;

public interface ClinicianPatientService {

    List<ClinicianPatientListItemDTO> getConnectedPatients(String clinicianId);

    AdherenceReportDTO getAdherenceReport(String clinicianId);

    List<SymptomLog> getSymptomTrends(String clinicianId);

    ClinicianSummaryDTO getClinicianSummary(String clinicianId);

    List<Medication> getPatientMedicationsForClinician(String clinicianId, String patientId);

    List<SymptomLog> getPatientSymptomsForClinician(String clinicianId, String patientId);
}
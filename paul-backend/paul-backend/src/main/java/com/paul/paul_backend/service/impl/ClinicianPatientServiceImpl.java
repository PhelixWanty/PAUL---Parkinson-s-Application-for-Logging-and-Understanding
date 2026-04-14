package com.paul.paul_backend.service.impl;

import com.paul.paul_backend.dto.AdherenceReportDTO;
import com.paul.paul_backend.dto.ClinicianPatientListItemDTO;
import com.paul.paul_backend.dto.ClinicianSummaryDTO;
import com.paul.paul_backend.model.ConnectionStatus;
import com.paul.paul_backend.model.ConnectionType;
import com.paul.paul_backend.model.Medication;
import com.paul.paul_backend.model.PatientConnection;
import com.paul.paul_backend.model.SymptomLog;
import com.paul.paul_backend.model.User;
import com.paul.paul_backend.repository.MedicationRepository;
import com.paul.paul_backend.repository.PatientConnectionRepository;
import com.paul.paul_backend.repository.SymptomLogRepository;
import com.paul.paul_backend.repository.UserRepository;
import com.paul.paul_backend.service.ClinicianPatientService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ClinicianPatientServiceImpl implements ClinicianPatientService {

    private final PatientConnectionRepository patientConnectionRepository;
    private final UserRepository userRepository;
    private final MedicationRepository medicationRepository;
    private final SymptomLogRepository symptomLogRepository;

    @Override
    public List<ClinicianPatientListItemDTO> getConnectedPatients(String clinicianId) {
        List<PatientConnection> connections =
                patientConnectionRepository
                        .findByConnectedUserIdAndConnectionTypeAndStatusAndPatientAcceptedTrueAndConnectedUserAcceptedTrue(
                                clinicianId,
                                ConnectionType.CLINICIAN,
                                ConnectionStatus.ACCEPTED
                        );

        List<ClinicianPatientListItemDTO> results = new ArrayList<>();

        for (PatientConnection connection : connections) {
            String patientId = connection.getPatientId();
            if (patientId == null || patientId.isBlank()) {
                continue;
            }

            User patient = userRepository.findById(patientId).orElse(null);
            if (patient == null) {
                continue;
            }

            ClinicianPatientListItemDTO dto = new ClinicianPatientListItemDTO();
            dto.setPatientId(patient.getId());
            dto.setPatientName(patient.getName());
            dto.setEmail(patient.getEmail());
            dto.setUserCode(patient.getUserCode());
            results.add(dto);
        }

        results.sort(
                Comparator.comparing(
                        item -> item.getPatientName() == null ? "" : item.getPatientName(),
                        String.CASE_INSENSITIVE_ORDER
                )
        );

        return results;
    }

    @Override
    public AdherenceReportDTO getAdherenceReport(String clinicianId) {
        List<ClinicianPatientListItemDTO> patients = getConnectedPatients(clinicianId);

        AdherenceReportDTO dto = new AdherenceReportDTO();

        if (patients.isEmpty()) {
            dto.setMedicationCount(0);
            return dto;
        }

        ClinicianPatientListItemDTO firstPatient = patients.get(0);
        String patientId = firstPatient.getPatientId();

        List<Medication> medications = getPatientMedicationsForClinician(clinicianId, patientId);

        dto.setPatientId(patientId);
        dto.setPatientName(firstPatient.getPatientName());
        dto.setMedicationCount(medications.size());

        return dto;
    }

    @Override
    public List<SymptomLog> getSymptomTrends(String clinicianId) {
        List<ClinicianPatientListItemDTO> patients = getConnectedPatients(clinicianId);

        if (patients.isEmpty()) {
            return List.of();
        }

        String patientId = patients.get(0).getPatientId();
        return getPatientSymptomsForClinician(clinicianId, patientId);
    }

    @Override
    public ClinicianSummaryDTO getClinicianSummary(String clinicianId) {
        List<ClinicianPatientListItemDTO> patients = getConnectedPatients(clinicianId);

        ClinicianSummaryDTO dto = new ClinicianSummaryDTO();
        dto.setConnectedPatientCount(patients.size());

        if (!patients.isEmpty()) {
            ClinicianPatientListItemDTO firstPatient = patients.get(0);
            dto.setPatientName(firstPatient.getPatientName());
            dto.setPatientId(firstPatient.getPatientId());

            List<Medication> medications =
                    getPatientMedicationsForClinician(clinicianId, firstPatient.getPatientId());
            List<SymptomLog> symptoms =
                    getPatientSymptomsForClinician(clinicianId, firstPatient.getPatientId());

            dto.setMedicationCount(medications.size());
            dto.setSymptomLogCount(symptoms.size());
        } else {
            dto.setMedicationCount(0);
            dto.setSymptomLogCount(0);
        }

        return dto;
    }

    @Override
    public List<Medication> getPatientMedicationsForClinician(String clinicianId, String patientId) {
        ensureClinicianCanAccessPatient(clinicianId, patientId);
        return medicationRepository.findByUserId(patientId);
    }

    @Override
    public List<SymptomLog> getPatientSymptomsForClinician(String clinicianId, String patientId) {
        ensureClinicianCanAccessPatient(clinicianId, patientId);
        return symptomLogRepository.findByUserIdOrderByCreatedAtDesc(patientId);
    }

    private void ensureClinicianCanAccessPatient(String clinicianId, String patientId) {
        boolean allowed =
                patientConnectionRepository
                        .existsByPatientIdAndConnectedUserIdAndConnectionTypeAndStatusAndPatientAcceptedTrueAndConnectedUserAcceptedTrue(
                                patientId,
                                clinicianId,
                                ConnectionType.CLINICIAN,
                                ConnectionStatus.ACCEPTED
                        );

        if (!allowed) {
            throw new AccessDeniedException("Clinician is not authorized to access this patient.");
        }
    }
}
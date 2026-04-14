package com.paul.paul_backend.service;

import com.paul.paul_backend.dto.MedicationRequest;
import com.paul.paul_backend.model.Medication;
import com.paul.paul_backend.repository.MedicationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MedicationService {

    private final MedicationRepository medicationRepository;
    private final MedicationLogService medicationLogService;

    public Medication create(String userId, MedicationRequest req) {
        Medication med = Medication.builder()
                .userId(userId)
                .name(req.getName())
                .dosage(req.getDosage())
                .instructions(req.getInstructions())
                .times(req.getTimes() != null ? req.getTimes() : List.of())
                .active(req.getActive() != null ? req.getActive() : true)
                .build();

        return medicationRepository.save(med);
    }

    public List<Medication> list(String userId) {
        return medicationRepository.findByUserId(userId);
    }

    public Medication get(String userId, String id) {
        return medicationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new RuntimeException("Medication not found"));
    }

    public Medication update(String userId, String id, MedicationRequest req) {
        Medication med = get(userId, id);

        if (req.getName() != null) med.setName(req.getName());
        if (req.getDosage() != null) med.setDosage(req.getDosage());
        if (req.getInstructions() != null) med.setInstructions(req.getInstructions());
        if (req.getTimes() != null) med.setTimes(req.getTimes());
        if (req.getActive() != null) med.setActive(req.getActive());

        return medicationRepository.save(med);
    }

    public void delete(String userId, String id, boolean deleteLogs) {
        Medication med = get(userId, id);

        if (deleteLogs) {
            medicationLogService.deleteLogsForMedication(userId, id);
        }

        medicationRepository.delete(med);
    }
}
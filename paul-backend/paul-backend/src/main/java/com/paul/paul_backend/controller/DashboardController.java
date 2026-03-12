package com.paul.paul_backend.controller;

import com.paul.paul_backend.dto.MedicationCardDTO;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @GetMapping("/medications")
    public List<MedicationCardDTO> getMedications() {
        return List.of(
                new MedicationCardDTO("Aspirin", "08:00", false),
                new MedicationCardDTO("Vitamin D", "14:00", false)
        );
    }
}
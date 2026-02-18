package com.paul.paul_backend.controller;

import com.paul.paul_backend.model.Medication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@CrossOrigin
public class DashboardController {

    @GetMapping("/medications")
    public List<Medication> getMedications() {
        return List.of(
                new Medication("Carbidopa/Levodopa", "08:00 AM", false),
                new Medication("Vitamin D", "02:00 PM", false)
        );
    }
}

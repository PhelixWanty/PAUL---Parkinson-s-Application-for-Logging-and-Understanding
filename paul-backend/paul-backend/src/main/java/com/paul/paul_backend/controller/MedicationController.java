package com.paul.paul_backend.controller;

import com.paul.paul_backend.dto.MedicationRequest;
import com.paul.paul_backend.model.Medication;
import com.paul.paul_backend.security.AuthUtil;
import com.paul.paul_backend.service.MedicationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/medications")
@RequiredArgsConstructor
public class MedicationController {

    private final MedicationService medicationService;

    @PostMapping
    public Medication create(@RequestBody MedicationRequest req) {
        String userId = AuthUtil.currentUserId();
        return medicationService.create(userId, req);
    }

    @GetMapping
    public List<Medication> list() {
        String userId = AuthUtil.currentUserId();
        System.out.println("MedicationController current userId = " + userId);
        return medicationService.list(userId);
    }

    @GetMapping("/{id}")
    public Medication get(@PathVariable String id) {
        String userId = AuthUtil.currentUserId();
        return medicationService.get(userId, id);
    }

    @PutMapping("/{id}")
    public Medication update(@PathVariable String id, @RequestBody MedicationRequest req) {
        String userId = AuthUtil.currentUserId();
        return medicationService.update(userId, id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(
            @PathVariable String id,
            @RequestParam(name = "deleteLogs", defaultValue = "false") boolean deleteLogs
    ) {
        String userId = AuthUtil.currentUserId();
        medicationService.delete(userId, id, deleteLogs);
    }
}
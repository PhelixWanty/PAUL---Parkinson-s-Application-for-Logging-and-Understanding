package com.paul.paul_backend.controller;

import com.paul.paul_backend.dto.ReminderSettingsRequest;
import com.paul.paul_backend.model.ReminderSettings;
import com.paul.paul_backend.security.AuthUtil;
import com.paul.paul_backend.service.ReminderService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reminders")
@RequiredArgsConstructor
public class ReminderController {

    private final ReminderService reminderService;

    @GetMapping("/settings")
    public ReminderSettings getSettings() {
        String userId = AuthUtil.currentUserId();
        return reminderService.get(userId);
    }

    @PostMapping("/settings")
    public ReminderSettings saveSettings(@RequestBody ReminderSettingsRequest req) {
        String userId = AuthUtil.currentUserId();
        return reminderService.upsert(userId, req);
    }

    // Placeholder endpoint: in real app, system would schedule push reminders
    @PostMapping("/simulate-missed")
    public String simulateMissedDose() {
        return "Placeholder: would trigger missed-dose notification logic.";
    }
}
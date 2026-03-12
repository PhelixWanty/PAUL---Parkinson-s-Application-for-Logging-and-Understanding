package com.paul.paul_backend.service;

import com.paul.paul_backend.dto.ReminderSettingsRequest;
import com.paul.paul_backend.model.ReminderSettings;
import com.paul.paul_backend.repository.ReminderSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ReminderService {

    private final ReminderSettingsRepository repo;

    public ReminderSettings upsert(String userId, ReminderSettingsRequest req) {
        ReminderSettings settings = repo.findByUserId(userId)
                .orElse(ReminderSettings.builder().userId(userId).build());

        settings.setEnabled(req.isEnabled());
        settings.setNotifyIfMissed(req.isNotifyIfMissed());
        settings.setMissedAfterMinutes(req.getMissedAfterMinutes());

        return repo.save(settings);
    }

    public ReminderSettings get(String userId) {
        return repo.findByUserId(userId)
                .orElse(ReminderSettings.builder()
                        .userId(userId)
                        .enabled(false)
                        .notifyIfMissed(false)
                        .missedAfterMinutes(30)
                        .build());
    }
}
package com.paul.paul_backend.dto;

import lombok.Data;

@Data
public class ReminderSettingsRequest {
    private boolean enabled;
    private boolean notifyIfMissed;
    private int missedAfterMinutes; // e.g. 30
}
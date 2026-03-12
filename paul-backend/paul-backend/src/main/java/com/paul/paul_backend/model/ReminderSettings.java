package com.paul.paul_backend.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "reminder_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReminderSettings {
    @Id
    private String id;

    private String userId;

    // MVP toggles
    private boolean enabled;
    private boolean notifyIfMissed; // “Optional notifications for missed doses”

    // minutes after scheduled time before considered missed
    private int missedAfterMinutes;
}
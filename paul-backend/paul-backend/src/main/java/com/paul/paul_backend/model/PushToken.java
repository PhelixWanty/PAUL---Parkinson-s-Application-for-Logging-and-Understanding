package com.paul.paul_backend.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "push_tokens")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushToken {

    @Id
    private String id;

    private String userId;
    private String expoPushToken;
    private String platform; // ios / android
    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;
}
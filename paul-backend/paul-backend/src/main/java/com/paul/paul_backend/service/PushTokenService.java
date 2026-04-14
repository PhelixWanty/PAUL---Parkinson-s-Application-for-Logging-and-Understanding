package com.paul.paul_backend.service;

import com.paul.paul_backend.model.PushToken;
import com.paul.paul_backend.repository.PushTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class PushTokenService {

    private final PushTokenRepository pushTokenRepository;

    public void saveToken(String userId, String expoPushToken, String platform) {
        if (expoPushToken == null || expoPushToken.isBlank()) {
            throw new RuntimeException("Expo push token is required.");
        }

        PushToken token = pushTokenRepository
                .findByUserIdAndExpoPushToken(userId, expoPushToken)
                .orElse(
                        PushToken.builder()
                                .userId(userId)
                                .expoPushToken(expoPushToken)
                                .createdAt(Instant.now())
                                .build()
                );

        token.setPlatform(platform);
        token.setActive(true);
        token.setUpdatedAt(Instant.now());

        pushTokenRepository.save(token);
    }
}
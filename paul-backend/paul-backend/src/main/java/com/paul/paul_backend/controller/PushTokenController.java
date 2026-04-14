package com.paul.paul_backend.controller;

import com.paul.paul_backend.dto.SavePushTokenRequest;
import com.paul.paul_backend.security.AuthUtil;
import com.paul.paul_backend.service.PushTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/push-tokens")
@RequiredArgsConstructor
public class PushTokenController {

    private final PushTokenService pushTokenService;

    @PostMapping("/me")
    public ResponseEntity<String> saveMyPushToken(@RequestBody SavePushTokenRequest request) {
        pushTokenService.saveToken(
                AuthUtil.currentUserId(),
                request.getExpoPushToken(),
                request.getPlatform()
        );

        return ResponseEntity.ok("Push token saved.");
    }
}
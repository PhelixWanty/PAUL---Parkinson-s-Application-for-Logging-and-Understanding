package com.paul.paul_backend.dto;

import lombok.Data;

@Data
public class SavePushTokenRequest {
    private String expoPushToken;
    private String platform;
}
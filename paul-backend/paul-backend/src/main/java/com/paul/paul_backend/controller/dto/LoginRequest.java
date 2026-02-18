package com.paul.paul_backend.controller.dto;

import lombok.Data;

@Data
public class LoginRequest {
    private String email;
    private String password;
}

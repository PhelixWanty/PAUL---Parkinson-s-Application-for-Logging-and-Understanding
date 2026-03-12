package com.paul.paul_backend.controller;

import com.paul.paul_backend.dto.LoginRequest;
import com.paul.paul_backend.dto.LoginResponse;
import com.paul.paul_backend.model.User;
import com.paul.paul_backend.security.JwtUtil;
import com.paul.paul_backend.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        try {
            User saved = authService.register(user);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            // JSON error response instead of plain text
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        try {
            User user = authService.login(req.getEmail(), req.getPassword());

            // Safety: if service returns null instead of throwing
            if (user == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password"));
            }

            // ✅ If your JwtUtil currently only accepts ONE param, use the 1-param call:
            // String token = JwtUtil.generateToken(user.getEmail());

            // ✅ If your JwtUtil accepts 2 params (email + role), keep this:
            String token = JwtUtil.generateToken(user.getEmail(), user.getRole().name());

            return ResponseEntity.ok(new LoginResponse(token, user.getRole().name(), user.getEmail()));
        } catch (IllegalArgumentException e) {
            // JSON error response instead of plain text
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }
}
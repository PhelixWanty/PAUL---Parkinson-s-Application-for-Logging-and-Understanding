package com.paul.paul_backend.controller;

import com.paul.paul_backend.controller.dto.LoginRequest;
import com.paul.paul_backend.controller.dto.LoginResponse;
import com.paul.paul_backend.model.User;
import com.paul.paul_backend.security.JwtUtil;
import com.paul.paul_backend.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
            return ResponseEntity.ok(authService.register(user));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        try {
            User user = authService.login(req.getEmail(), req.getPassword());

            String token = JwtUtil.generateToken(
                    user.getEmail(),
                    user.getRole().name()
            );

            return ResponseEntity.ok(new LoginResponse(token, user.getRole().name(), user.getEmail()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).body(e.getMessage());
        }
    }


}

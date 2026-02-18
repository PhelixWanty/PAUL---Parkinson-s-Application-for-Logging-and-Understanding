package com.paul.paul_backend.controller;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/me")
@CrossOrigin
public class MeController {

    @GetMapping
    public Map<String, Object> me(Authentication auth) {
        return Map.of(
                "principal", auth.getPrincipal(),
                "authorities", auth.getAuthorities()
        );
    }
}

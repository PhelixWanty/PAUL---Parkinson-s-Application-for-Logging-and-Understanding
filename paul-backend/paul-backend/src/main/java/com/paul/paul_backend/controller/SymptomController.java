package com.paul.paul_backend.controller;

import com.paul.paul_backend.dto.SymptomLogRequest;
import com.paul.paul_backend.model.SymptomLog;
import com.paul.paul_backend.security.AuthUtil;
import com.paul.paul_backend.service.SymptomService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/symptoms")
@RequiredArgsConstructor
public class SymptomController {

    private final SymptomService symptomService;

    @PostMapping
    public SymptomLog create(@RequestBody SymptomLogRequest req) {
        String userId = AuthUtil.currentUserId();
        return symptomService.create(userId, req);
    }

    @GetMapping
    public List<SymptomLog> list() {
        String userId = AuthUtil.currentUserId();
        return symptomService.list(userId);
    }
}
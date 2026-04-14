package com.paul.paul_backend.controller;

import com.paul.paul_backend.dto.WeeklySummaryDTO;
import com.paul.paul_backend.security.AuthUtil;
import com.paul.paul_backend.service.SummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/summaries")
@RequiredArgsConstructor
public class SummaryController {

    private final SummaryService summaryService;

    @GetMapping("/weekly")
    public WeeklySummaryDTO getWeeklySummary() {
        return summaryService.getWeeklySummary(AuthUtil.currentUserId());
    }
}
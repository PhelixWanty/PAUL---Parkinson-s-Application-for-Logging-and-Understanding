package com.paul.paul_backend.controller;

import com.paul.paul_backend.dto.ConnectionActionDTO;
import com.paul.paul_backend.dto.ConnectionRequestDTO;
import com.paul.paul_backend.dto.PatientConnectionResponse;
import com.paul.paul_backend.security.AuthUtil;
import com.paul.paul_backend.service.PatientConnectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/connections")
@RequiredArgsConstructor
public class PatientConnectionController {

    private final PatientConnectionService patientConnectionService;

    @PostMapping("/request")
    public PatientConnectionResponse createRequest(@RequestBody ConnectionRequestDTO request) {
        String currentUserId = AuthUtil.currentUserId();
        return patientConnectionService.createRequestByPatientCode(
                currentUserId,
                request.getUserCode(),
                request.getConnectionType()
        );
    }

    @PostMapping("/{connectionId}/respond")
    public PatientConnectionResponse respond(
            @PathVariable String connectionId,
            @RequestBody ConnectionActionDTO request
    ) {
        String currentUserId = AuthUtil.currentUserId();
        return patientConnectionService.respondToConnection(
                currentUserId,
                connectionId,
                request.isAccept()
        );
    }

    @GetMapping("/me")
    public List<PatientConnectionResponse> getMyConnections() {
        String currentUserId = AuthUtil.currentUserId();
        return patientConnectionService.getMyConnections(currentUserId);
    }

    @GetMapping("/{connectionId}")
    public PatientConnectionResponse getConnection(@PathVariable String connectionId) {
        String currentUserId = AuthUtil.currentUserId();
        return patientConnectionService.getConnection(currentUserId, connectionId);
    }

    @DeleteMapping("/{connectionId}")
    public void cancelOrDelete(@PathVariable String connectionId) {
        String currentUserId = AuthUtil.currentUserId();
        patientConnectionService.cancelOrDeleteConnection(currentUserId, connectionId);
    }
}
package com.paul.paul_backend.service;

import com.paul.paul_backend.dto.PatientConnectionResponse;
import com.paul.paul_backend.model.ConnectionType;
import com.paul.paul_backend.model.PatientConnection;

import java.util.List;

public interface PatientConnectionService {

    PatientConnectionResponse createRequestByPatientCode(
            String currentUserId,
            String userCode,
            ConnectionType connectionType
    );

    PatientConnectionResponse respondToConnection(
            String currentUserId,
            String connectionId,
            boolean accept
    );

    List<PatientConnectionResponse> getMyConnections(String currentUserId);

    PatientConnectionResponse getConnection(
            String currentUserId,
            String connectionId
    );

    void cancelOrDeleteConnection(
            String currentUserId,
            String connectionId
    );

    PatientConnection getConnectedCaregiverForPatient(String patientId);

    PatientConnection getConnectedClinicianForPatient(String patientId);
}
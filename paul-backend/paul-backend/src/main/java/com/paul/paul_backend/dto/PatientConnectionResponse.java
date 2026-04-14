package com.paul.paul_backend.dto;

import com.paul.paul_backend.model.ConnectionStatus;
import com.paul.paul_backend.model.ConnectionType;
import com.paul.paul_backend.model.PatientConnection;
import com.paul.paul_backend.model.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PatientConnectionResponse {

    private String id;

    private String patientId;
    private String patientName;
    private String patientEmail;
    private String patientCode;

    private String connectedUserId;
    private String connectedUserName;
    private String connectedUserEmail;
    private String connectedUserCode;

    private ConnectionType connectionType;
    private ConnectionStatus status;

    private boolean patientAccepted;
    private boolean connectedUserAccepted;
    private boolean fullyAccepted;

    public static PatientConnectionResponse from(
            PatientConnection connection,
            User patient,
            User connectedUser
    ) {
        boolean fullyAccepted =
                connection.isPatientAccepted() && connection.isConnectedUserAccepted();

        return PatientConnectionResponse.builder()
                .id(connection.getId())

                .patientId(connection.getPatientId())
                .patientName(patient != null ? patient.getName() : null)
                .patientEmail(patient != null ? patient.getEmail() : null)
                .patientCode(patient != null ? patient.getUserCode() : null)

                .connectedUserId(connection.getConnectedUserId())
                .connectedUserName(connectedUser != null ? connectedUser.getName() : null)
                .connectedUserEmail(connectedUser != null ? connectedUser.getEmail() : null)
                .connectedUserCode(connectedUser != null ? connectedUser.getUserCode() : null)

                .connectionType(connection.getConnectionType())
                .status(connection.getStatus())

                .patientAccepted(connection.isPatientAccepted())
                .connectedUserAccepted(connection.isConnectedUserAccepted())
                .fullyAccepted(fullyAccepted)
                .build();
    }
}
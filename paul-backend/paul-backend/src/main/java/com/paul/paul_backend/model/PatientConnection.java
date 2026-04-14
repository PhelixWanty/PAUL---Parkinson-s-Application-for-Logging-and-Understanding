package com.paul.paul_backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "patient_connections")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PatientConnection {

    @Id
    private String id;

    private String patientId;
    private String connectedUserId;

    private ConnectionType connectionType;
    private ConnectionStatus status;

    private boolean patientAccepted;
    private boolean connectedUserAccepted;
    private boolean fullyAccepted;

    private String requestedByUserId;

    private Instant requestedAt;
    private Instant patientAcceptedAt;
    private Instant connectedUserAcceptedAt;
    private Instant finalizedAt;

    private String patientName;
    private String patientEmail;
    private String patientCode;

    private String connectedUserName;
    private String connectedUserEmail;
    private String connectedUserCode;
}
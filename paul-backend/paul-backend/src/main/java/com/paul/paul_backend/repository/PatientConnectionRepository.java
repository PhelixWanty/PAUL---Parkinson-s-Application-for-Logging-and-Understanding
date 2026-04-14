package com.paul.paul_backend.repository;

import com.paul.paul_backend.model.ConnectionStatus;
import com.paul.paul_backend.model.ConnectionType;
import com.paul.paul_backend.model.PatientConnection;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface PatientConnectionRepository extends MongoRepository<PatientConnection, String> {

    List<PatientConnection> findByPatientIdOrConnectedUserId(String patientId, String connectedUserId);

    List<PatientConnection> findByPatientId(String patientId);

    Optional<PatientConnection> findByPatientIdAndConnectedUserIdAndConnectionType(
            String patientId,
            String connectedUserId,
            ConnectionType connectionType
    );

    Optional<PatientConnection> findByPatientIdAndConnectedUserIdAndConnectionTypeAndStatus(
            String patientId,
            String connectedUserId,
            ConnectionType connectionType,
            ConnectionStatus status
    );

    List<PatientConnection> findByConnectedUserIdAndConnectionTypeAndStatusAndPatientAcceptedTrueAndConnectedUserAcceptedTrue(
            String connectedUserId,
            ConnectionType connectionType,
            ConnectionStatus status
    );

    boolean existsByPatientIdAndConnectedUserIdAndConnectionTypeAndStatusAndPatientAcceptedTrueAndConnectedUserAcceptedTrue(
            String patientId,
            String connectedUserId,
            ConnectionType connectionType,
            ConnectionStatus status
    );

    boolean existsByPatientIdAndConnectionTypeAndStatus(
            String patientId,
            ConnectionType connectionType,
            ConnectionStatus status
    );

    Optional<PatientConnection> findByPatientIdAndConnectionTypeAndStatus(
            String patientId,
            ConnectionType connectionType,
            ConnectionStatus status
    );

    Optional<PatientConnection> findFirstByConnectedUserIdAndConnectionTypeAndStatusAndPatientAcceptedTrueAndConnectedUserAcceptedTrue(
            String connectedUserId,
            ConnectionType connectionType,
            ConnectionStatus status
    );

    List<PatientConnection> findByConnectedUserIdAndConnectionTypeAndStatus(
            String connectedUserId,
            ConnectionType connectionType,
            ConnectionStatus status
    );
}
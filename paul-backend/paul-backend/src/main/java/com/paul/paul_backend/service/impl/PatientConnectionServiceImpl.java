package com.paul.paul_backend.service.impl;

import com.paul.paul_backend.dto.PatientConnectionResponse;
import com.paul.paul_backend.model.ConnectionStatus;
import com.paul.paul_backend.model.ConnectionType;
import com.paul.paul_backend.model.PatientConnection;
import com.paul.paul_backend.model.User;
import com.paul.paul_backend.model.UserRole;
import com.paul.paul_backend.repository.PatientConnectionRepository;
import com.paul.paul_backend.repository.UserRepository;
import com.paul.paul_backend.service.PatientConnectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class PatientConnectionServiceImpl implements PatientConnectionService {

    private final PatientConnectionRepository patientConnectionRepository;
    private final UserRepository userRepository;

    @Override
    public PatientConnectionResponse createRequestByPatientCode(
            String currentUserId,
            String userCode,
            ConnectionType connectionType
    ) {
        User patient = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Current user not found."));

        User connectedUser = userRepository.findByUserCode(userCode)
                .orElseThrow(() -> new IllegalArgumentException("No user found for that code."));

        if (Objects.equals(patient.getId(), connectedUser.getId())) {
            throw new IllegalArgumentException("You cannot connect to yourself.");
        }

        if (patient.getRole() != UserRole.PATIENT) {
            throw new IllegalArgumentException("Only patients can create connection requests.");
        }

        ConnectionType resolvedType = connectionType;
        if (resolvedType == null) {
            if (connectedUser.getRole() == UserRole.CAREGIVER) {
                resolvedType = ConnectionType.CAREGIVER;
            } else if (connectedUser.getRole() == UserRole.CLINICIAN) {
                resolvedType = ConnectionType.CLINICIAN;
            } else {
                throw new IllegalArgumentException("That code does not belong to a caregiver or clinician.");
            }
        }

        if (resolvedType == ConnectionType.CAREGIVER && connectedUser.getRole() != UserRole.CAREGIVER) {
            throw new IllegalArgumentException("That code does not belong to a caregiver.");
        }

        if (resolvedType == ConnectionType.CLINICIAN && connectedUser.getRole() != UserRole.CLINICIAN) {
            throw new IllegalArgumentException("That code does not belong to a clinician.");
        }

        PatientConnection existing = patientConnectionRepository
                .findByPatientIdAndConnectedUserIdAndConnectionType(
                        patient.getId(),
                        connectedUser.getId(),
                        resolvedType
                )
                .orElse(null);

        if (existing != null) {
            if (existing.getStatus() == ConnectionStatus.CANCELLED ||
                    existing.getStatus() == ConnectionStatus.REJECTED) {

                Instant now = Instant.now();

                existing.setStatus(ConnectionStatus.PENDING);
                existing.setPatientAccepted(true);
                existing.setConnectedUserAccepted(false);
                existing.setFullyAccepted(false);
                existing.setRequestedByUserId(patient.getId());
                existing.setRequestedAt(now);
                existing.setPatientAcceptedAt(now);
                existing.setConnectedUserAcceptedAt(null);
                existing.setFinalizedAt(null);

                existing.setPatientName(patient.getName());
                existing.setPatientEmail(patient.getEmail());
                existing.setPatientCode(patient.getUserCode());

                existing.setConnectedUserName(connectedUser.getName());
                existing.setConnectedUserEmail(connectedUser.getEmail());
                existing.setConnectedUserCode(connectedUser.getUserCode());

                PatientConnection saved = patientConnectionRepository.save(existing);
                return toResponse(saved);
            }

            return toResponse(existing);
        }

        Instant now = Instant.now();

        PatientConnection connection = PatientConnection.builder()
                .patientId(patient.getId())
                .connectedUserId(connectedUser.getId())
                .connectionType(resolvedType)
                .status(ConnectionStatus.PENDING)
                .patientAccepted(true)
                .connectedUserAccepted(false)
                .fullyAccepted(false)
                .requestedByUserId(patient.getId())
                .requestedAt(now)
                .patientAcceptedAt(now)
                .connectedUserAcceptedAt(null)
                .finalizedAt(null)
                .patientName(patient.getName())
                .patientEmail(patient.getEmail())
                .patientCode(patient.getUserCode())
                .connectedUserName(connectedUser.getName())
                .connectedUserEmail(connectedUser.getEmail())
                .connectedUserCode(connectedUser.getUserCode())
                .build();

        PatientConnection saved = patientConnectionRepository.save(connection);
        return toResponse(saved);
    }

    @Override
    public PatientConnectionResponse respondToConnection(
            String currentUserId,
            String connectionId,
            boolean accept
    ) {
        PatientConnection connection = patientConnectionRepository.findById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("Connection not found."));

        boolean isPatient = Objects.equals(connection.getPatientId(), currentUserId);
        boolean isConnectedUser = Objects.equals(connection.getConnectedUserId(), currentUserId);

        if (!isPatient && !isConnectedUser) {
            throw new AccessDeniedException("You are not allowed to respond to this connection.");
        }

        if (!accept) {
            connection.setStatus(ConnectionStatus.REJECTED);
            connection.setFullyAccepted(false);

            if (isPatient) {
                connection.setPatientAccepted(false);
                connection.setPatientAcceptedAt(null);
            }

            if (isConnectedUser) {
                connection.setConnectedUserAccepted(false);
                connection.setConnectedUserAcceptedAt(null);
            }

            connection.setFinalizedAt(null);

            PatientConnection saved = patientConnectionRepository.save(connection);
            return toResponse(saved);
        }

        Instant now = Instant.now();

        if (isPatient) {
            connection.setPatientAccepted(true);
            connection.setPatientAcceptedAt(now);
        }

        if (isConnectedUser) {
            connection.setConnectedUserAccepted(true);
            connection.setConnectedUserAcceptedAt(now);
        }

        boolean fullyAccepted =
                connection.isPatientAccepted() && connection.isConnectedUserAccepted();

        connection.setFullyAccepted(fullyAccepted);
        connection.setStatus(fullyAccepted ? ConnectionStatus.ACCEPTED : ConnectionStatus.PENDING);

        if (fullyAccepted) {
            connection.setFinalizedAt(now);
        } else {
            connection.setFinalizedAt(null);
        }

        PatientConnection saved = patientConnectionRepository.save(connection);
        return toResponse(saved);
    }

    @Override
    public List<PatientConnectionResponse> getMyConnections(String currentUserId) {
        return patientConnectionRepository
                .findByPatientIdOrConnectedUserId(currentUserId, currentUserId)
                .stream()
                .sorted(
                        Comparator.comparing(
                                (PatientConnection c) ->
                                        c.getRequestedAt() == null ? Instant.EPOCH : c.getRequestedAt()
                        ).reversed()
                )
                .map(this::toResponse)
                .toList();
    }

    @Override
    public PatientConnectionResponse getConnection(String currentUserId, String connectionId) {
        PatientConnection connection = patientConnectionRepository.findById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("Connection not found."));

        ensureUserCanAccessConnection(currentUserId, connection);
        return toResponse(connection);
    }

    @Override
    public void cancelOrDeleteConnection(String currentUserId, String connectionId) {
        PatientConnection connection = patientConnectionRepository.findById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("Connection not found."));

        ensureUserCanAccessConnection(currentUserId, connection);
        patientConnectionRepository.delete(connection);
    }

    @Override
    public PatientConnection getConnectedCaregiverForPatient(String patientId) {
        return patientConnectionRepository
                .findByPatientIdAndConnectionTypeAndStatus(
                        patientId,
                        ConnectionType.CAREGIVER,
                        ConnectionStatus.ACCEPTED
                )
                .filter(c -> c.isPatientAccepted() && c.isConnectedUserAccepted())
                .orElse(null);
    }

    @Override
    public PatientConnection getConnectedClinicianForPatient(String patientId) {
        return patientConnectionRepository
                .findByPatientIdAndConnectionTypeAndStatus(
                        patientId,
                        ConnectionType.CLINICIAN,
                        ConnectionStatus.ACCEPTED
                )
                .filter(c -> c.isPatientAccepted() && c.isConnectedUserAccepted())
                .orElse(null);
    }

    private void ensureUserCanAccessConnection(String currentUserId, PatientConnection connection) {
        boolean allowed =
                Objects.equals(connection.getPatientId(), currentUserId) ||
                        Objects.equals(connection.getConnectedUserId(), currentUserId);

        if (!allowed) {
            throw new AccessDeniedException("You are not allowed to access this connection.");
        }
    }

    private PatientConnectionResponse toResponse(PatientConnection connection) {
        return PatientConnectionResponse.builder()
                .id(connection.getId())
                .patientId(connection.getPatientId())
                .patientName(connection.getPatientName())
                .patientEmail(connection.getPatientEmail())
                .patientCode(connection.getPatientCode())
                .connectedUserId(connection.getConnectedUserId())
                .connectedUserName(connection.getConnectedUserName())
                .connectedUserEmail(connection.getConnectedUserEmail())
                .connectedUserCode(connection.getConnectedUserCode())
                .connectionType(connection.getConnectionType())
                .status(connection.getStatus())
                .patientAccepted(connection.isPatientAccepted())
                .connectedUserAccepted(connection.isConnectedUserAccepted())
                .fullyAccepted(connection.isPatientAccepted() && connection.isConnectedUserAccepted())
                .build();
    }
}
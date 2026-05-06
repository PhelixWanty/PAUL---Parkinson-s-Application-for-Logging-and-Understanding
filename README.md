# Proof of Concept API Documentation

PAUL uses a Spring Boot REST API to connect the React Native frontend with the MongoDB database. The API is organized by controller classes. Each controller is responsible for a specific part of the application, such as authentication, medication tracking, symptom logging, patient connections, caregiver access, and clinician access.

Most protected endpoints require a JWT token in the request header:

Authorization: Bearer <token>

---

# AuthController

Handles user registration and login for patients, caregivers, and clinicians.

## Endpoints

### POST /api/auth/register

Registers a new user account.

### Request Body Example

```json
{
  "name": "John Patient",
  "email": "john@example.com",
  "password": "password123",
  "role": "PATIENT"
}
```

### Response Example

```json
{
  "token": "jwt-token",
  "userId": "mongo-user-id",
  "name": "John Patient",
  "email": "john@example.com",
  "role": "PATIENT",
  "userCode": "A1B2C3D4"
}
```

### POST /api/auth/login

Logs in an existing user.

### Request Body Example

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

### Response Example

```json
{
  "token": "jwt-token",
  "userId": "mongo-user-id",
  "name": "John Patient",
  "email": "john@example.com",
  "role": "PATIENT",
  "userCode": "A1B2C3D4"
}
```

---

# UserController

Handles the currently logged-in user’s profile information.

## Endpoints

### GET /api/users/me

Returns the current user’s profile.

### Response Example

```json
{
  "id": "mongo-user-id",
  "name": "John Patient",
  "email": "john@example.com",
  "role": "PATIENT",
  "userCode": "A1B2C3D4"
}
```

### PUT /api/users/me

Updates the current user’s name or profile information.

### Request Body Example

```json
{
  "name": "John Updated"
}
```

### PUT /api/users/me/password

Updates the current user’s password.

### Request Body Example

```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

---

# MedicationController

Handles medication creation, viewing, updating, and deleting for patients.

## Endpoints

### POST /api/medications

Creates a new medication for the logged-in patient.

### Request Body Example

```json
{
  "name": "Carbidopa-Levodopa",
  "dosage": "25/100 mg",
  "instructions": "Take with water",
  "times": ["08:00", "13:00", "18:00"],
  "active": true
}
```

### GET /api/medications

Returns all medications for the logged-in patient.

### Response Example

```json
[
  {
    "id": "medication-id",
    "userId": "patient-user-id",
    "name": "Carbidopa-Levodopa",
    "dosage": "25/100 mg",
    "instructions": "Take with water",
    "times": ["08:00", "13:00", "18:00"],
    "active": true
  }
]
```

### GET /api/medications/{id}

Returns one medication by ID.

### PUT /api/medications/{id}

Updates an existing medication.

### DELETE /api/medications/{id}

Deletes or disables a medication.

---

# MedicationLogController

Handles medication adherence tracking.

## Endpoints

### POST /api/medication-logs

Creates a medication log when a patient marks a dose as taken or missed.

### Request Body Example

```json
{
  "medicationId": "medication-id",
  "scheduledTime": "08:00",
  "status": "TAKEN",
  "timestamp": "2026-05-06T12:00:00Z"
}
```

### GET /api/medication-logs

Returns medication logs for the logged-in patient.

### GET /api/medication-logs/medication/{medicationId}

Returns logs for a specific medication.

### Response Example

```json
[
  {
    "id": "log-id",
    "userId": "patient-user-id",
    "medicationId": "medication-id",
    "scheduledTime": "08:00",
    "status": "TAKEN",
    "timestamp": "2026-05-06T12:00:00Z"
  }
]
```

---

# SymptomController

Handles patient symptom tracking.

## Endpoints

### POST /api/symptoms

Creates a new symptom log.

### Request Body Example

```json
{
  "category": "MOTOR",
  "symptomName": "Tremor",
  "severity": 7,
  "durationMinutes": 30,
  "feeling": "BAD",
  "note": "Tremor was worse in the morning"
}
```

### GET /api/symptoms

Returns all symptom logs for the logged-in patient.

### Response Example

```json
[
  {
    "id": "symptom-id",
    "userId": "patient-user-id",
    "category": "MOTOR",
    "symptomName": "Tremor",
    "severity": 7,
    "durationMinutes": 30,
    "feeling": "BAD",
    "note": "Tremor was worse in the morning",
    "createdAt": "2026-05-06T12:00:00Z"
  }
]
```

### PUT /api/symptoms/{id}

Updates an existing symptom log.

### DELETE /api/symptoms/{id}

Deletes a symptom log.

---

# ShareSettingsController

Handles what information a patient chooses to share with caregivers or clinicians.

## Endpoints

### GET /api/share-settings

Returns the patient’s current share settings.

### Response Example

```json
{
  "shareMedicationLogs": true,
  "shareSymptomLogs": true,
  "shareAdherenceSummary": true
}
```

### PUT /api/share-settings

Updates the patient’s share settings.

### Request Body Example

```json
{
  "shareMedicationLogs": true,
  "shareSymptomLogs": false,
  "shareAdherenceSummary": true
}
```

---

# PatientConnectionController

Handles connection requests between patients, caregivers, and clinicians.

## Endpoints

### POST /api/connections/request

Creates a connection request using a patient, caregiver, or clinician user code.

### Request Body Example

```json
{
  "userCode": "A1B2C3D4",
  "connectionType": "CAREGIVER"
}
```

### GET /api/connections

Returns the logged-in user’s current connections.

### GET /api/connections/pending

Returns pending connection requests.

### POST /api/connections/{connectionId}/respond

Accepts or rejects a connection request.

### Request Body Example

```json
{
  "accepted": true
}
```

### DELETE /api/connections/{connectionId}

Deletes an existing connection.

---

# CaregiverController

Handles caregiver access to connected patient information.

## Endpoints

### GET /api/caregiver/patient

Returns the caregiver’s connected patient.

### Response Example

```json
{
  "patientId": "patient-user-id",
  "patientName": "John Patient",
  "patientEmail": "john@example.com"
}
```

### GET /api/caregiver/patient/medications

Returns the connected patient’s medications if sharing is enabled.

### GET /api/caregiver/patient/medication-logs

Returns the connected patient’s medication logs if sharing is enabled.

### GET /api/caregiver/patient/symptoms

Returns the connected patient’s symptom logs if sharing is enabled.

### GET /api/caregiver/alerts

Returns caregiver alerts for missed medications or high-severity symptoms.

### Response Example

```json
[
  {
    "type": "MISSED_MEDICATION",
    "message": "Patient missed Carbidopa-Levodopa at 08:00",
    "createdAt": "2026-05-06T12:00:00Z"
  }
]
```

---

# ClinicianController

Handles clinician access to connected patients and patient summaries.

## Endpoints

### GET /api/clinician/patients

Returns all accepted patients connected to the clinician.

### Response Example

```json
[
  {
    "patientId": "patient-user-id",
    "patientName": "John Patient",
    "patientEmail": "john@example.com",
    "adherencePercent": 85,
    "symptomCountLast30Days": 12
  }
]
```

### GET /api/clinician/patients/{patientId}/summary

Returns a summary for a specific connected patient.

### GET /api/clinician/patients/{patientId}/medication-logs

Returns medication logs for a connected patient.

### GET /api/clinician/patients/{patientId}/symptoms

Returns symptom logs for a connected patient.

### GET /api/clinician/patients/{patientId}/export

Exports patient data for clinician review.

Possible export types:

* Medication logs
* Symptom logs
* Combined patient history

---

# NotificationController

Handles medication reminders, missed-dose notifications, and caregiver-related alerts.

## Endpoints

### GET /api/notifications

Returns notifications for the logged-in user.

### POST /api/notifications

Creates a new notification.

### Request Body Example

```json
{
  "userId": "patient-user-id",
  "title": "Medication Reminder",
  "message": "Time to take Carbidopa-Levodopa",
  "type": "MEDICATION_REMINDER"
}
```

### PUT /api/notifications/{id}/read

Marks a notification as read.

---

# Security Notes

The PAUL API uses JWT authentication. After login or registration, the frontend stores the returned token and sends it with each protected request.

Protected requests include this header:

```text
Authorization: Bearer <token>
```

Role-based access is enforced so that:

* Patients can access their own medications, symptoms, and share settings.
* Caregivers can only access accepted connected patient data.
* Clinicians can only access accepted connected patient records.
* Users cannot access another user’s private data without an accepted connection.

---

# Proof of Concept Status

This API documentation represents the proof-of-concept version of PAUL. The main purpose is to demonstrate the working full-stack communication between the React Native frontend, Spring Boot backend, and MongoDB database. The API supports the core features required for the project, including authentication, medication tracking, symptom logging, caregiver monitoring, clinician review, and secure patient connections.

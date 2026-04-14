package com.paul.paul_backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "patient_share_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PatientShareSettings {

    @Id
    private String id;

    private String patientId;

    @Builder.Default
    private boolean shareWeeklySummariesWithCaregiver = true;

    @Builder.Default
    private boolean shareSymptomTrendsWithCaregiver = true;

    @Builder.Default
    private boolean shareMissedDoseAlertsWithCaregiver = true;

    @Builder.Default
    private boolean shareClinicianReports = true;
}
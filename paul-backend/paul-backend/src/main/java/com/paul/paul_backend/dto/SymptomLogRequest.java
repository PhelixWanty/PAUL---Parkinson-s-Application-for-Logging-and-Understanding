package com.paul.paul_backend.dto;

import com.paul.paul_backend.model.SymptomFeeling;
import lombok.Data;

@Data
public class SymptomLogRequest {

    private String category;
    private String symptomName;
    private int severity;
    private int durationMinutes;
    private String note;
    private SymptomFeeling feeling;
}
package com.paul.paul_backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class MedicationRequest {
    private String name;
    private String dosage;
    private String instructions;
    private List<String> times; // ["08:00","14:00"]
    private Boolean active;
}
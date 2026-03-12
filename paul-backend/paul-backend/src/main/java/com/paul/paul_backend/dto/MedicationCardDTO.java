package com.paul.paul_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class MedicationCardDTO {
    private String name;
    private String time;
    private boolean taken;
}
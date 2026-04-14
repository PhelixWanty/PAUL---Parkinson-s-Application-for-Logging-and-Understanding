package com.paul.paul_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TrendPointDTO {
    private String label;
    private int value;
}
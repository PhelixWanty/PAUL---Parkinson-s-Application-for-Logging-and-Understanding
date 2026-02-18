package com.paul.paul_backend.model;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Medication {
    private String name;
    private String time;
    private boolean taken;
}

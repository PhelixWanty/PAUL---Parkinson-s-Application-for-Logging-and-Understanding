package com.paul.paul_backend.dto;

import com.paul.paul_backend.model.ConnectionType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConnectionRequestDTO {
    private String userCode;
    private ConnectionType connectionType;
}
package com.batchpilot.dto;

import com.batchpilot.model.ConnectionState;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConnectionStatusResponse {
    private String environmentId;
    private ConnectionState state;
    private String message;
    private Long latencyMs;
    private Long connectedSince;
}

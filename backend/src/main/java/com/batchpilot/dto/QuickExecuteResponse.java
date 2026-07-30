package com.batchpilot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuickExecuteResponse {
    private String environmentId;
    private String command;
    private String stdout;
    private String stderr;
    private int exitCode;
    private boolean success;
    private long durationMs;
    private String executedAt;
}

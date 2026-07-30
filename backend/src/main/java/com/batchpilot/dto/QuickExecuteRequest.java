package com.batchpilot.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class QuickExecuteRequest {

    @NotBlank
    private String environmentId;

    @NotBlank
    private String command;

    /** Optional hard timeout; defaults to 60s server-side if unset. */
    private Integer timeoutSeconds;
}

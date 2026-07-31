package com.batchpilot.dto;

import com.batchpilot.model.EnvironmentType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Payload for creating/updating an environment. Username is intentionally absent:
 * it is always assigned server-side from the configured default.
 */
@Data
public class EnvironmentRequest {

    @NotBlank
    private String name;

    private EnvironmentType type = EnvironmentType.CUSTOM;

    @NotBlank
    private String serverIp;

    @Min(1)
    @Max(65535)
    private int sshPort = 22;

    @NotBlank
    private String ppkPath;

    /** Optional. See {@link com.batchpilot.model.Environment#getYarnRmUrl()}. */
    private String yarnRmUrl;
}

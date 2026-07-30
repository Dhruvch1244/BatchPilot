package com.batchpilot.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * A saved SSH target. Username is always {@code hadoop} (or whatever the server
 * configures as the default) and is never taken from user input.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class Environment {

    private String id;
    private String name;
    private EnvironmentType type = EnvironmentType.CUSTOM;
    private String serverIp;
    private int sshPort = 22;

    /** Filesystem path to the PuTTY .ppk private key. Contents are never read into the model. */
    private String ppkPath;

    /** Fixed to the server-configured default (normally "hadoop"); not user-editable. */
    private String username;

    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();
}

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

    /**
     * Optional override for the YARN ResourceManager's own base URL (e.g.
     * {@code http://ip-10-185-214-60.ec2.internal:8088}), used to fetch applications/nodes
     * directly via the RM's REST API instead of shelling out to the `yarn` CLI over SSH. When
     * blank, {@link com.batchpilot.service.YarnService} derives it from {@link #serverIp} using
     * AWS's own internal DNS naming convention (ip-a-b-c-d.ec2.internal) on the standard RM
     * webapp port (8088) - the common case when the RM lives on the same EC2 host the SSH
     * session connects to.
     */
    private String yarnRmUrl;

    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();
}

package com.batchpilot.ssh;

import jakarta.annotation.PreDestroy;
import org.apache.sshd.client.SshClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Owns a single, shared Apache MINA SSHD client for the whole application. All
 * per-environment sessions are opened through this client and closed individually;
 * only the client itself is started once and stopped on shutdown.
 */
@Component
public class SshClientProvider {

    private static final Logger log = LoggerFactory.getLogger(SshClientProvider.class);

    private final SshClient client;

    public SshClientProvider() {
        this.client = SshClient.setUpDefaultClient();
        this.client.start();
        log.info("SSH client started");
    }

    public SshClient getClient() {
        return client;
    }

    @PreDestroy
    public void shutdown() {
        try {
            client.stop();
            log.info("SSH client stopped");
        } catch (Exception e) {
            log.warn("Error stopping SSH client", e);
        }
    }
}

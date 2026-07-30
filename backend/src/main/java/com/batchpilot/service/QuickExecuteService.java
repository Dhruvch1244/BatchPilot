package com.batchpilot.service;

import com.batchpilot.dto.QuickExecuteRequest;
import com.batchpilot.dto.QuickExecuteResponse;
import com.batchpilot.exception.SshOperationException;
import com.batchpilot.ssh.SshConnectionManager;
import org.apache.sshd.client.channel.ChannelExec;
import org.apache.sshd.client.channel.ClientChannelEvent;
import org.apache.sshd.client.session.ClientSession;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Runs one-off commands on an already-connected environment without opening an
 * interactive terminal tab.
 */
@Service
public class QuickExecuteService {

    private static final int DEFAULT_TIMEOUT_SECONDS = 60;

    private final SshConnectionManager connectionManager;

    public QuickExecuteService(SshConnectionManager connectionManager) {
        this.connectionManager = connectionManager;
    }

    public QuickExecuteResponse execute(QuickExecuteRequest request) {
        ClientSession session = connectionManager.getActiveSession(request.getEnvironmentId());
        int timeoutSeconds = request.getTimeoutSeconds() != null ? request.getTimeoutSeconds() : DEFAULT_TIMEOUT_SECONDS;

        ByteArrayOutputStream stdout = new ByteArrayOutputStream();
        ByteArrayOutputStream stderr = new ByteArrayOutputStream();
        long start = System.currentTimeMillis();
        int exitCode;

        try (ChannelExec channel = session.createExecChannel(request.getCommand())) {
            channel.setOut(stdout);
            channel.setErr(stderr);
            channel.open().verify(10, TimeUnit.SECONDS);

            Set<ClientChannelEvent> events = channel.waitFor(
                    EnumSet.of(ClientChannelEvent.CLOSED),
                    TimeUnit.SECONDS.toMillis(timeoutSeconds));
            if (events.contains(ClientChannelEvent.TIMEOUT)) {
                throw new SshOperationException("Command timed out after " + timeoutSeconds + "s");
            }
            Integer status = channel.getExitStatus();
            exitCode = status != null ? status : -1;
        } catch (SshOperationException e) {
            throw e;
        } catch (Exception e) {
            throw new SshOperationException("Command execution failed: " + e.getMessage(), e);
        }

        long durationMs = System.currentTimeMillis() - start;
        return QuickExecuteResponse.builder()
                .environmentId(request.getEnvironmentId())
                .command(request.getCommand())
                .stdout(stdout.toString(StandardCharsets.UTF_8))
                .stderr(stderr.toString(StandardCharsets.UTF_8))
                .exitCode(exitCode)
                .success(exitCode == 0)
                .durationMs(durationMs)
                .executedAt(Instant.now().toString())
                .build();
    }
}

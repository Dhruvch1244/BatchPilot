package com.batchpilot.service;

import com.batchpilot.dto.QuickExecuteRequest;
import com.batchpilot.dto.QuickExecuteResponse;
import com.batchpilot.exception.SshOperationException;
import com.batchpilot.model.CommandHistoryEntry;
import com.batchpilot.model.CommandHistorySource;
import com.batchpilot.model.Environment;
import com.batchpilot.repository.CommandHistoryRepository;
import com.batchpilot.ssh.SshConnectionManager;
import org.apache.sshd.client.channel.ChannelExec;
import org.apache.sshd.client.channel.ClientChannelEvent;
import org.apache.sshd.client.session.ClientSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Runs one-off commands on an already-connected environment without opening an
 * interactive terminal tab. Also the single choke point S3 Transfer's generated
 * {@code aws s3 cp} commands run through, which is why command history is recorded
 * here rather than in each caller - it automatically covers both.
 */
@Service
public class QuickExecuteService {

    private static final Logger log = LoggerFactory.getLogger(QuickExecuteService.class);
    private static final int DEFAULT_TIMEOUT_SECONDS = 60;

    private final SshConnectionManager connectionManager;
    private final EnvironmentService environmentService;
    private final CommandHistoryRepository commandHistoryRepository;

    public QuickExecuteService(SshConnectionManager connectionManager,
                                EnvironmentService environmentService,
                                CommandHistoryRepository commandHistoryRepository) {
        this.connectionManager = connectionManager;
        this.environmentService = environmentService;
        this.commandHistoryRepository = commandHistoryRepository;
    }

    public QuickExecuteResponse execute(QuickExecuteRequest request) {
        return execute(request, CommandHistorySource.QUICK_EXECUTE);
    }

    public QuickExecuteResponse execute(QuickExecuteRequest request, CommandHistorySource source) {
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
        long executedAtMillis = System.currentTimeMillis();
        QuickExecuteResponse response = QuickExecuteResponse.builder()
                .environmentId(request.getEnvironmentId())
                .command(request.getCommand())
                .stdout(stdout.toString(StandardCharsets.UTF_8))
                .stderr(stderr.toString(StandardCharsets.UTF_8))
                .exitCode(exitCode)
                .success(exitCode == 0)
                .durationMs(durationMs)
                .executedAt(Instant.ofEpochMilli(executedAtMillis).toString())
                .build();

        recordHistory(request, source, response, executedAtMillis);
        return response;
    }

    /** Best-effort: a history write failure shouldn't fail a command that already ran
     * successfully and whose result the caller is about to receive. */
    private void recordHistory(QuickExecuteRequest request, CommandHistorySource source,
                                QuickExecuteResponse response, long executedAtMillis) {
        try {
            String environmentName = request.getEnvironmentId();
            try {
                Environment env = environmentService.findById(request.getEnvironmentId());
                environmentName = env.getName();
            } catch (Exception ignored) {
                // Fall back to the raw ID if the environment was since deleted/renamed.
            }
            commandHistoryRepository.add(new CommandHistoryEntry(
                    UUID.randomUUID().toString(),
                    request.getEnvironmentId(),
                    environmentName,
                    source,
                    request.getCommand(),
                    response.isSuccess(),
                    response.getExitCode(),
                    response.getDurationMs(),
                    executedAtMillis));
        } catch (Exception e) {
            log.warn("Failed to record command history: {}", e.getMessage());
        }
    }
}

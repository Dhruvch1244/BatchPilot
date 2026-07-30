package com.batchpilot.service;

import com.batchpilot.dto.YarnActionResponse;
import com.batchpilot.exception.SshOperationException;
import com.batchpilot.model.YarnApplication;
import com.batchpilot.ssh.SshConnectionManager;
import org.apache.sshd.client.channel.ChannelExec;
import org.apache.sshd.client.channel.ClientChannelEvent;
import org.apache.sshd.client.session.ClientSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * Runs the small set of `yarn` (Hadoop resource manager) CLI commands the UI exposes —
 * list/status/kill/logs — over the environment's existing SSH session. There is no
 * separate connection mechanism: every call reuses {@link SshConnectionManager}'s
 * already-authenticated session, the same way {@link QuickExecuteService} does.
 */
@Service
public class YarnService {

    private static final Logger log = LoggerFactory.getLogger(YarnService.class);
    private static final int COMMAND_TIMEOUT_SECONDS = 30;
    private static final int LOGS_TIMEOUT_SECONDS = 60;
    private static final int DEFAULT_LOG_LINES = 500;

    /** YARN's own application ID format (application_<clusterTimestamp>_<sequence>). Validated
     * before any ID is interpolated into a shell command, since exec channels run through a
     * remote shell and are otherwise open to command injection. */
    private static final Pattern APPLICATION_ID_PATTERN = Pattern.compile("^application_\\d+_\\d{1,10}$");

    private final SshConnectionManager connectionManager;

    public YarnService(SshConnectionManager connectionManager) {
        this.connectionManager = connectionManager;
    }

    public List<YarnApplication> listApplications(String environmentId) {
        String output = runCommand(environmentId, "yarn application -list -appStates ALL", COMMAND_TIMEOUT_SECONDS);
        return parseList(output);
    }

    public YarnApplication getStatus(String environmentId, String applicationId) {
        requireValidApplicationId(applicationId);
        String output = runCommand(environmentId, "yarn application -status " + applicationId, COMMAND_TIMEOUT_SECONDS);
        return parseStatus(output);
    }

    public YarnActionResponse kill(String environmentId, String applicationId) {
        requireValidApplicationId(applicationId);
        String output = runCommand(environmentId, "yarn application -kill " + applicationId, COMMAND_TIMEOUT_SECONDS);
        boolean success = output.toLowerCase(Locale.ROOT).contains("killed application");
        return new YarnActionResponse(success, success ? "Application killed" : output.trim());
    }

    public String getLogs(String environmentId, String applicationId, Integer lines) {
        requireValidApplicationId(applicationId);
        int tail = (lines != null && lines > 0) ? Math.min(lines, 5000) : DEFAULT_LOG_LINES;
        String command = "yarn logs -applicationId " + applicationId + " 2>&1 | tail -n " + tail;
        return runCommand(environmentId, command, LOGS_TIMEOUT_SECONDS);
    }

    private void requireValidApplicationId(String applicationId) {
        if (applicationId == null || !APPLICATION_ID_PATTERN.matcher(applicationId).matches()) {
            throw new SshOperationException("Invalid YARN application ID: " + applicationId);
        }
    }

    private String runCommand(String environmentId, String command, int timeoutSeconds) {
        ClientSession session = connectionManager.getActiveSession(environmentId);
        ByteArrayOutputStream stdout = new ByteArrayOutputStream();
        ByteArrayOutputStream stderr = new ByteArrayOutputStream();
        try (ChannelExec channel = session.createExecChannel(command)) {
            channel.setOut(stdout);
            channel.setErr(stderr);
            channel.open().verify(10, TimeUnit.SECONDS);
            Set<ClientChannelEvent> events = channel.waitFor(
                    EnumSet.of(ClientChannelEvent.CLOSED), TimeUnit.SECONDS.toMillis(timeoutSeconds));
            if (events.contains(ClientChannelEvent.TIMEOUT)) {
                throw new SshOperationException("yarn command timed out after " + timeoutSeconds + "s: " + command);
            }
        } catch (SshOperationException e) {
            throw e;
        } catch (Exception e) {
            throw new SshOperationException("yarn command failed: " + e.getMessage(), e);
        }
        String out = stdout.toString(StandardCharsets.UTF_8);
        String err = stderr.toString(StandardCharsets.UTF_8);
        return err.isBlank() ? out : out + "\n" + err;
    }

    private List<YarnApplication> parseList(String output) {
        List<YarnApplication> apps = new ArrayList<>();
        String[] lines = output.split("\n", -1);
        for (String rawLine : lines) {
            String line = rawLine.strip();
            if (line.isEmpty() || line.startsWith("Total number of applications")
                    || line.startsWith("Application-Id")) {
                continue;
            }
            String[] cols = rawLine.split("\t");
            if (cols.length < 9) {
                continue;
            }
            apps.add(YarnApplication.builder()
                    .applicationId(cols[0].strip())
                    .applicationName(cols[1].strip())
                    .applicationType(cols[2].strip())
                    .user(cols[3].strip())
                    .queue(cols[4].strip())
                    .state(cols[5].strip())
                    .finalStatus(cols[6].strip())
                    .progressPercent(parseProgress(cols[7].strip()))
                    .trackingUrl(cols[8].strip())
                    .build());
        }
        return apps;
    }

    private YarnApplication parseStatus(String output) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (String rawLine : output.split("\n", -1)) {
            String line = rawLine.strip();
            int sep = line.indexOf(" : ");
            if (sep <= 0) {
                continue;
            }
            fields.put(line.substring(0, sep).strip(), line.substring(sep + 3).strip());
        }
        if (fields.isEmpty() || !fields.containsKey("Application-Id")) {
            throw new SshOperationException("Unable to parse yarn application status output");
        }
        return YarnApplication.builder()
                .applicationId(fields.get("Application-Id"))
                .applicationName(fields.getOrDefault("Application-Name", ""))
                .applicationType(fields.getOrDefault("Application-Type", ""))
                .user(fields.getOrDefault("User", ""))
                .queue(fields.getOrDefault("Queue", ""))
                .state(fields.getOrDefault("State", ""))
                .finalStatus(fields.getOrDefault("Final-State", ""))
                .progressPercent(parseProgress(fields.getOrDefault("Progress", "")))
                .trackingUrl(fields.get("Tracking-URL"))
                .startTime(parseEpochMillis(fields.get("Start-Time")))
                .finishTime(parseEpochMillis(fields.get("Finish-Time")))
                .build();
    }

    private Integer parseProgress(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Math.round(Float.parseFloat(raw.replace("%", "").strip()));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Long parseEpochMillis(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            long value = Long.parseLong(raw.strip());
            return value > 0 ? value : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}

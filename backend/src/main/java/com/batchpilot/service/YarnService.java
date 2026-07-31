package com.batchpilot.service;

import com.batchpilot.dto.YarnActionResponse;
import com.batchpilot.exception.SshOperationException;
import com.batchpilot.model.Environment;
import com.batchpilot.model.YarnApplication;
import com.batchpilot.model.YarnNode;
import com.batchpilot.ssh.SshConnectionManager;
import org.apache.sshd.client.channel.ChannelExec;
import org.apache.sshd.client.channel.ClientChannelEvent;
import org.apache.sshd.client.session.ClientSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.function.Supplier;
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

    /** Standard YARN ResourceManager webapp port, used when an environment doesn't set an
     * explicit {@code yarnRmUrl} override. */
    private static final int DEFAULT_RM_PORT = 8088;
    /** How long to stop retrying the RM REST API for an environment after it fails once, so an
     * unreachable RM doesn't add a multi-second timeout to every single poll - just the first
     * one in each window. */
    private static final Duration REST_COOLDOWN = Duration.ofMinutes(2);

    /** YARN's own application ID format (application_<clusterTimestamp>_<sequence>). Validated
     * before any ID is interpolated into a shell command, since exec channels run through a
     * remote shell and are otherwise open to command injection. */
    private static final Pattern APPLICATION_ID_PATTERN = Pattern.compile("^application_\\d+_\\d{1,10}$");
    private static final Pattern ATTEMPT_ID_PATTERN = Pattern.compile("^appattempt_\\d+_\\d{1,10}_\\d{1,10}$");
    private static final Pattern QUEUE_NAME_PATTERN = Pattern.compile("^[A-Za-z0-9_.-]{1,128}$");
    private static final long MAX_LOG_DOWNLOAD_BYTES = 5L * 1024 * 1024 * 1024; // 5 GB safety cap

    private final SshConnectionManager connectionManager;
    private final EnvironmentService environmentService;
    private final YarnRestClient restClient;

    /** Per-environment cooldown: while now() is before the stored instant, REST is skipped
     * entirely and calls go straight to SSH. Cleared as soon as a REST call succeeds again. */
    private final Map<String, Instant> restUnavailableUntil = new ConcurrentHashMap<>();

    public YarnService(SshConnectionManager connectionManager, EnvironmentService environmentService,
                        YarnRestClient restClient) {
        this.connectionManager = connectionManager;
        this.environmentService = environmentService;
        this.restClient = restClient;
    }

    public List<YarnApplication> listApplications(String environmentId) {
        Environment environment = environmentService.findById(environmentId);
        return withRestFallback(environmentId, environment,
                restClient::listApplications,
                () -> parseList(runCommand(environmentId, "yarn application -list -appStates ALL", COMMAND_TIMEOUT_SECONDS)));
    }

    public YarnApplication getStatus(String environmentId, String applicationId) {
        requireValidApplicationId(applicationId);
        Environment environment = environmentService.findById(environmentId);
        return withRestFallback(environmentId, environment,
                baseUrl -> restClient.getApplication(baseUrl, applicationId),
                () -> parseStatus(runCommand(environmentId, "yarn application -status " + applicationId, COMMAND_TIMEOUT_SECONDS)));
    }

    public YarnActionResponse kill(String environmentId, String applicationId) {
        requireValidApplicationId(applicationId);
        Environment environment = environmentService.findById(environmentId);
        return withRestFallback(environmentId, environment,
                baseUrl -> {
                    restClient.killApplication(baseUrl, applicationId);
                    return new YarnActionResponse(true, "Application killed");
                },
                () -> {
                    String output = runCommand(environmentId, "yarn application -kill " + applicationId, COMMAND_TIMEOUT_SECONDS);
                    boolean success = output.toLowerCase(Locale.ROOT).contains("killed application");
                    return new YarnActionResponse(success, success ? "Application killed" : output.trim());
                });
    }

    public String getLogs(String environmentId, String applicationId, Integer lines) {
        requireValidApplicationId(applicationId);
        int tail = (lines != null && lines > 0) ? Math.min(lines, 5000) : DEFAULT_LOG_LINES;
        String command = "yarn logs -applicationId " + applicationId + " 2>&1 | tail -n " + tail;
        return runCommand(environmentId, command, LOGS_TIMEOUT_SECONDS);
    }

    /**
     * Streams full (or filtered/size-capped) logs straight to {@code out} — no in-memory
     * buffering — so multi-gigabyte YARN logs don't have to fit in heap. {@code sizeLimitMb}
     * is applied via `tail -c`, taking the *last* N MiB (logs can run past 24 GB), and an
     * optional grep pattern narrows further (e.g. errors only). Both are applied remotely,
     * before anything crosses the wire.
     */
    public void streamLogDownload(String environmentId, String applicationId, Long sizeLimitMb,
                                   String grepPattern, boolean caseInsensitiveGrep, OutputStream out) {
        requireValidApplicationId(applicationId);
        long limitMb = (sizeLimitMb != null && sizeLimitMb > 0) ? sizeLimitMb : 1024L;
        long limitBytes = Math.min(limitMb * 1024 * 1024, MAX_LOG_DOWNLOAD_BYTES);

        StringBuilder command = new StringBuilder("yarn logs -applicationId ")
                .append(applicationId)
                .append(" 2>&1 | tail -c ")
                .append(limitBytes);
        if (grepPattern != null && !grepPattern.isBlank()) {
            command.append(" | grep ").append(caseInsensitiveGrep ? "-i " : "").append(shellQuote(grepPattern.strip()));
        }
        runCommandStreaming(environmentId, command.toString(), LOGS_TIMEOUT_SECONDS, out);
    }

    public List<YarnNode> listNodes(String environmentId) {
        Environment environment = environmentService.findById(environmentId);
        return withRestFallback(environmentId, environment,
                restClient::listNodes,
                () -> parseNodes(runCommand(environmentId, "yarn node -list -all", COMMAND_TIMEOUT_SECONDS)));
    }

    /** Raw `yarn queue -status <queue>` output — key:value shaped like application -status, but
     * queue metrics vary enough across Hadoop versions that returning the text as-is is more
     * reliable than a brittle field-by-field parse. */
    public String queueStatus(String environmentId, String queueName) {
        String queue = requireValid(queueName, QUEUE_NAME_PATTERN, "queue name");
        return runCommand(environmentId, "yarn queue -status " + queue, COMMAND_TIMEOUT_SECONDS);
    }

    /** Raw `yarn applicationattempt -list <appId>` output. */
    public String applicationAttempts(String environmentId, String applicationId) {
        requireValidApplicationId(applicationId);
        return runCommand(environmentId, "yarn applicationattempt -list " + applicationId, COMMAND_TIMEOUT_SECONDS);
    }

    /** Raw `yarn container -list <attemptId>` output. */
    public String containers(String environmentId, String attemptId) {
        if (attemptId == null || !ATTEMPT_ID_PATTERN.matcher(attemptId).matches()) {
            throw new SshOperationException("Invalid YARN application attempt ID: " + attemptId);
        }
        return runCommand(environmentId, "yarn container -list " + attemptId, COMMAND_TIMEOUT_SECONDS);
    }

    /**
     * Tries {@code restOperation} against the environment's RM REST API first (when it hasn't
     * recently failed and a base URL can be derived), falling back to {@code sshFallback} - the
     * existing `yarn` CLI-over-SSH path - on any failure. A successful REST call clears any
     * earlier cooldown, so a temporarily-unreachable RM recovers automatically.
     */
    private <T> T withRestFallback(String environmentId, Environment environment,
                                    Function<String, T> restOperation, Supplier<T> sshFallback) {
        if (restEnabled(environmentId)) {
            String baseUrl = resolveRmBaseUrl(environment);
            if (baseUrl != null) {
                try {
                    T result = restOperation.apply(baseUrl);
                    restUnavailableUntil.remove(environmentId);
                    return result;
                } catch (YarnRestUnavailableException e) {
                    log.debug("YARN RM REST API unavailable for environment {} ({}); falling back to SSH for {}s: {}",
                            environmentId, baseUrl, REST_COOLDOWN.toSeconds(), e.getMessage());
                    restUnavailableUntil.put(environmentId, Instant.now().plus(REST_COOLDOWN));
                }
            }
        }
        return sshFallback.get();
    }

    private boolean restEnabled(String environmentId) {
        Instant until = restUnavailableUntil.get(environmentId);
        return until == null || Instant.now().isAfter(until);
    }

    /** Explicit {@code yarnRmUrl} wins when set; otherwise derives the RM's base URL from the
     * environment's {@code serverIp} using AWS's own internal-DNS naming convention
     * (ip-a-b-c-d.ec2.internal) on the standard RM webapp port - the common case when the RM
     * lives on the same EC2 host the SSH session already connects to. Returns null (meaning:
     * skip REST, go straight to SSH) only when there's no IP to derive from at all. */
    private String resolveRmBaseUrl(Environment environment) {
        String override = environment.getYarnRmUrl();
        if (override != null && !override.isBlank()) {
            String trimmed = override.strip();
            return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
        }
        String ip = environment.getServerIp();
        if (ip == null || ip.isBlank()) {
            return null;
        }
        return "http://ip-" + ip.strip().replace('.', '-') + ".ec2.internal:" + DEFAULT_RM_PORT;
    }

    private void requireValidApplicationId(String applicationId) {
        if (applicationId == null || !APPLICATION_ID_PATTERN.matcher(applicationId).matches()) {
            throw new SshOperationException("Invalid YARN application ID: " + applicationId);
        }
    }

    private String requireValid(String value, Pattern pattern, String label) {
        String trimmed = value == null ? "" : value.strip();
        if (!pattern.matcher(trimmed).matches()) {
            throw new SshOperationException("Invalid " + label + ": " + value);
        }
        return trimmed;
    }

    /** Wraps in single quotes for safe interpolation into a remote shell command, escaping any
     * embedded single quotes — standard `'\''` POSIX-shell technique. */
    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\\''") + "'";
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

    /** Same as {@link #runCommand}, but writes stdout directly to {@code out} as it arrives
     * instead of buffering it — required for log downloads that can be gigabytes. */
    private void runCommandStreaming(String environmentId, String command, int timeoutSeconds, OutputStream out) {
        ClientSession session = connectionManager.getActiveSession(environmentId);
        try (ChannelExec channel = session.createExecChannel(command)) {
            channel.setOut(out);
            channel.setErr(out);
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
    }

    private List<YarnNode> parseNodes(String output) {
        List<YarnNode> nodes = new ArrayList<>();
        for (String rawLine : output.split("\n", -1)) {
            String line = rawLine.strip();
            if (line.isEmpty() || line.startsWith("Total Nodes") || line.startsWith("Node-Id")) {
                continue;
            }
            String[] cols = rawLine.split("\t");
            if (cols.length < 4) {
                continue;
            }
            Integer running;
            try {
                running = Integer.parseInt(cols[3].strip());
            } catch (NumberFormatException e) {
                running = null;
            }
            nodes.add(YarnNode.builder()
                    .nodeId(cols[0].strip())
                    .nodeState(cols[1].strip())
                    .nodeHttpAddress(cols[2].strip())
                    .runningContainers(running)
                    .build());
        }
        return nodes;
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

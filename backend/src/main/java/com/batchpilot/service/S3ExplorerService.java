package com.batchpilot.service;

import com.batchpilot.dto.S3ListResult;
import com.batchpilot.exception.SshOperationException;
import com.batchpilot.model.S3Entry;
import com.batchpilot.ssh.SshConnectionManager;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.sshd.client.channel.ChannelExec;
import org.apache.sshd.client.channel.ClientChannelEvent;
import org.apache.sshd.client.session.ClientSession;
import org.apache.sshd.sftp.client.SftpClient;
import org.apache.sshd.sftp.client.SftpClientFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * Browses and transfers S3 objects by running {@code aws} CLI commands (list/cp) on the
 * environment's own SSH session, the same way {@link com.batchpilot.service.S3TransferService}
 * runs {@code aws s3 cp} for vendor staging — "execute on the EMR box" is deliberately faster
 * and simpler here than the backend talking to S3 directly: the EMR/edge node already has
 * working AWS credentials and (usually) a much better network path to S3 than wherever
 * BatchPilot's backend happens to be running, and there's no separate credential story to
 * manage. Uploads/downloads stage through a remote temp file over SFTP (the same session)
 * since {@code aws s3 cp} needs a real path on either side, not a stream.
 *
 * <p>Listing uses {@code aws s3api list-objects-v2} with a {@code /} delimiter (so it reads
 * like a folder tree, not a flat key dump) and {@code --max-items}/{@code --starting-token} for
 * proper server-side pagination — a bucket with hundreds of thousands of keys never has to be
 * paged through, or held in memory, all at once.
 */
@Service
public class S3ExplorerService {

    private static final Logger log = LoggerFactory.getLogger(S3ExplorerService.class);
    private static final int LIST_TIMEOUT_SECONDS = 30;
    /** Generous: a single `cp` can be moving a genuinely large object, and this is a
     * synchronous exec-and-wait, not a progress-streamed transfer. */
    private static final int TRANSFER_TIMEOUT_SECONDS = 1800;
    private static final int CLEANUP_TIMEOUT_SECONDS = 15;
    private static final int DEFAULT_PAGE_SIZE = 100;
    private static final int MAX_PAGE_SIZE = 1000;

    private static final Pattern BUCKET_PATTERN = Pattern.compile("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$");

    private final SshConnectionManager connectionManager;
    private final ObjectMapper objectMapper;

    public S3ExplorerService(SshConnectionManager connectionManager, ObjectMapper objectMapper) {
        this.connectionManager = connectionManager;
        this.objectMapper = objectMapper;
    }

    public S3ListResult list(String environmentId, String bucket, String prefix, String continuationToken, Integer pageSize) {
        String prefixNormalized = prefix == null ? "" : prefix;
        StringBuilder command = new StringBuilder("aws s3api list-objects-v2 --bucket ")
                .append(resolveBucketArg(bucket))
                .append(" --prefix ").append(shellQuote(prefixNormalized))
                .append(" --delimiter ").append(shellQuote("/"))
                .append(" --max-items ").append(clampPageSize(pageSize))
                .append(" --output json");
        if (continuationToken != null && !continuationToken.isBlank()) {
            command.append(" --starting-token ").append(shellQuote(continuationToken));
        }
        String output = runCommand(environmentId, command.toString(), LIST_TIMEOUT_SECONDS);
        return parseListResult(bucket, prefixNormalized, output);
    }

    public void download(String environmentId, String bucket, String key, OutputStream out) {
        requireKey(key);
        String remoteTempDir = "/tmp/batchpilot-s3-dl-" + UUID.randomUUID();
        String remoteTempPath = remoteTempDir + "/" + lastSegment(key);
        String s3Uri = "s3://" + resolveBucketUriSegment(bucket) + "/" + shellQuote(key);
        try {
            runCommand(environmentId,
                    "mkdir -p " + shellQuote(remoteTempDir) + " && aws s3 cp " + s3Uri + " " + shellQuote(remoteTempPath),
                    TRANSFER_TIMEOUT_SECONDS);
            try (SftpClient sftp = openSftp(environmentId); InputStream in = sftp.read(remoteTempPath)) {
                in.transferTo(out);
            }
        } catch (IOException e) {
            throw new SshOperationException("Failed to download " + key + ": " + e.getMessage(), e);
        } finally {
            cleanupRemoteTemp(environmentId, remoteTempDir);
        }
    }

    public void upload(String environmentId, String bucket, String prefix, String fileName, InputStream data) {
        String baseName = sanitizeFileName(fileName);
        String key = normalizePrefix(prefix) + baseName;
        String remoteTempDir = "/tmp/batchpilot-s3-ul-" + UUID.randomUUID();
        String remoteTempPath = remoteTempDir + "/" + baseName;
        try (SftpClient sftp = openSftp(environmentId)) {
            sftp.mkdir(remoteTempDir);
            try (OutputStream out = sftp.write(remoteTempPath,
                    SftpClient.OpenMode.Create, SftpClient.OpenMode.Write, SftpClient.OpenMode.Truncate)) {
                data.transferTo(out);
            }
        } catch (IOException e) {
            throw new SshOperationException("Failed to stage " + fileName + " for upload: " + e.getMessage(), e);
        }
        try {
            String s3Uri = "s3://" + resolveBucketUriSegment(bucket) + "/" + shellQuote(key);
            runCommand(environmentId, "aws s3 cp " + shellQuote(remoteTempPath) + " " + s3Uri, TRANSFER_TIMEOUT_SECONDS);
        } finally {
            cleanupRemoteTemp(environmentId, remoteTempDir);
        }
    }

    private void cleanupRemoteTemp(String environmentId, String remoteTempDir) {
        try {
            runCommand(environmentId, "rm -rf " + shellQuote(remoteTempDir), CLEANUP_TIMEOUT_SECONDS);
        } catch (Exception e) {
            log.warn("Failed to clean up S3 Explorer temp dir {} on environment {}: {}",
                    remoteTempDir, environmentId, e.getMessage());
        }
    }

    private S3ListResult parseListResult(String bucket, String prefix, String rawJson) {
        JsonNode root;
        try {
            root = objectMapper.readTree(rawJson.isBlank() ? "{}" : rawJson);
        } catch (JsonProcessingException e) {
            throw new SshOperationException("Failed to parse aws s3api output: " + e.getMessage(), e);
        }
        List<S3Entry> entries = new ArrayList<>();
        for (JsonNode p : root.path("CommonPrefixes")) {
            String pfx = p.path("Prefix").asText(null);
            if (pfx == null || pfx.isBlank()) {
                continue;
            }
            entries.add(S3Entry.builder()
                    .key(pfx)
                    .name(lastSegment(pfx))
                    .directory(true)
                    .build());
        }
        for (JsonNode c : root.path("Contents")) {
            String key = c.path("Key").asText(null);
            // The listed prefix itself sometimes shows up as its own zero-byte "folder marker"
            // object (created whenever something makes an empty "folder" in the S3 console) -
            // it isn't a file a user asked to see, so it's dropped rather than shown as one.
            if (key == null || key.equals(prefix)) {
                continue;
            }
            entries.add(S3Entry.builder()
                    .key(key)
                    .name(lastSegment(key))
                    .directory(false)
                    .size(c.hasNonNull("Size") ? c.get("Size").asLong() : null)
                    .lastModified(parseInstant(c.path("LastModified").asText(null)))
                    .build());
        }
        entries.sort(Comparator.comparing(S3Entry::isDirectory).reversed()
                .thenComparing(S3Entry::getName, String.CASE_INSENSITIVE_ORDER));

        String nextToken = root.hasNonNull("NextToken") ? root.get("NextToken").asText() : null;
        return S3ListResult.builder()
                .bucket(bucket)
                .prefix(prefix)
                .entries(entries)
                .nextToken(nextToken)
                .build();
    }

    private Instant parseInstant(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(raw);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private int clampPageSize(Integer requested) {
        if (requested == null || requested <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(requested, MAX_PAGE_SIZE);
    }

    private void requireKey(String key) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("Object key is required");
        }
    }

    /** Strips any directory components from an uploaded file's original name before it's used
     * to build a remote SFTP path - otherwise a crafted name (embedded "/", "..") could steer
     * the write outside the per-upload temp directory. Same defense already used for uploaded
     * PPK keys in {@code KeyStorageService}. */
    private String sanitizeFileName(String fileName) {
        String base = (fileName == null || fileName.isBlank()) ? "upload.bin" : Path.of(fileName).getFileName().toString();
        return base.isBlank() ? "upload.bin" : base;
    }

    /** Ensures a prefix used as a key's parent directory is either empty or "/"-terminated,
     * so concatenating a file name onto it never produces "prefixfile.txt" instead of
     * "prefix/file.txt". */
    private String normalizePrefix(String prefix) {
        if (prefix == null || prefix.isBlank()) {
            return "";
        }
        String p = prefix.strip();
        return p.endsWith("/") ? p : p + "/";
    }

    private String lastSegment(String key) {
        String trimmed = key.endsWith("/") ? key.substring(0, key.length() - 1) : key;
        int idx = trimmed.lastIndexOf('/');
        return idx >= 0 ? trimmed.substring(idx + 1) : trimmed;
    }

    /** For a {@code --bucket} CLI argument: an explicit bucket is validated against S3's own
     * naming rules and used as-is; left blank, {@code $S3_BUCKET} is emitted verbatim (in
     * double quotes, so the *remote* shell expands it) rather than resolved here - same
     * "never substitute client-side" rule {@link S3TransferService} already follows for its
     * destination URI, so both features agree on where an environment's default bucket comes
     * from. */
    private String resolveBucketArg(String bucket) {
        if (bucket == null || bucket.isBlank()) {
            return "\"$S3_BUCKET\"";
        }
        return requireValidBucket(bucket);
    }

    /** Same idea as {@link #resolveBucketArg}, but for embedding directly into an
     * {@code s3://<bucket>/<key>} URI segment rather than as a standalone CLI argument - a
     * bare (unquoted) {@code $S3_BUCKET} here still expands correctly because it's followed
     * immediately by the already shell-quoted key with no intervening whitespace; adjacent
     * quoted/unquoted segments merge into a single shell word. */
    private String resolveBucketUriSegment(String bucket) {
        if (bucket == null || bucket.isBlank()) {
            return "$S3_BUCKET";
        }
        return requireValidBucket(bucket);
    }

    private String requireValidBucket(String bucket) {
        String trimmed = bucket.strip();
        if (!BUCKET_PATTERN.matcher(trimmed).matches()) {
            throw new IllegalArgumentException("Invalid bucket name: " + bucket);
        }
        return trimmed;
    }

    /** Wraps in single quotes for safe interpolation into a remote shell command, escaping any
     * embedded single quotes - standard `'\''` POSIX-shell technique. Used for prefixes, keys,
     * and continuation tokens, none of which can be restricted to a safe character allowlist
     * (S3 keys can contain almost anything printable, including spaces and unicode). */
    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\\''") + "'";
    }

    private SftpClient openSftp(String environmentId) throws IOException {
        ClientSession session = connectionManager.getActiveSession(environmentId);
        return SftpClientFactory.instance().createSftpClient(session);
    }

    private String runCommand(String environmentId, String command, int timeoutSeconds) {
        ClientSession session = connectionManager.getActiveSession(environmentId);
        ByteArrayOutputStream stdout = new ByteArrayOutputStream();
        ByteArrayOutputStream stderr = new ByteArrayOutputStream();
        int exitCode;
        try (ChannelExec channel = session.createExecChannel(command)) {
            channel.setOut(stdout);
            channel.setErr(stderr);
            channel.open().verify(10, TimeUnit.SECONDS);
            Set<ClientChannelEvent> events = channel.waitFor(
                    EnumSet.of(ClientChannelEvent.CLOSED), TimeUnit.SECONDS.toMillis(timeoutSeconds));
            if (events.contains(ClientChannelEvent.TIMEOUT)) {
                throw new SshOperationException("aws command timed out after " + timeoutSeconds + "s: " + command);
            }
            Integer status = channel.getExitStatus();
            exitCode = status != null ? status : -1;
        } catch (SshOperationException e) {
            throw e;
        } catch (Exception e) {
            throw new SshOperationException("aws command failed: " + e.getMessage(), e);
        }
        String out = stdout.toString(StandardCharsets.UTF_8);
        String err = stderr.toString(StandardCharsets.UTF_8);
        if (exitCode != 0) {
            String detail = err.isBlank() ? out : err;
            throw new SshOperationException("aws command failed (exit " + exitCode + "): " + detail.trim());
        }
        return out;
    }
}

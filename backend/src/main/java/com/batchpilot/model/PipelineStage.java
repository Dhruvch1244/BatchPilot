package com.batchpilot.model;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The stages of the batch file pipeline a YARN application name can belong to. Stage
 * membership is inferred heuristically from keywords in the application name (see
 * {@code StageTrackerService}) — there is no ground-truth pipeline-stage database
 * wired in, so this is an approximation, not an authoritative status.
 *
 * <p>Not every file goes through every stage — {@code OUTBOUND} in particular is
 * conditional (only some files have it) — so callers should only render stages that
 * actually have matches for a given file, not this full fixed list. The five stages
 * PREPROCESSOR, VALIDATION, NORMALIZATION, DELTA, and TRANSMISSION always occur in
 * that relative order when present ("the core flow"); any other recognized stage
 * (OUTBOUND, or a future addition) has no fixed position and is placed by timing
 * instead — see {@code StageTrackerService#buildFileResult}.
 */
public enum PipelineStage {
    PREPROCESSOR("Preprocessor", "preprocess"),
    VALIDATION("Validation", "valid"),
    NORMALIZATION("Normalization", "normal"),
    DELTA("Delta", "delta"),
    TRANSMISSION("Transmission", "transmi"),
    OUTBOUND("Outbound", "outbound");

    /** The relative order these stages always occur in when present; stages not in
     * this list (currently just OUTBOUND) have no fixed position of their own. */
    public static final List<PipelineStage> CORE_ORDER =
            List.of(PREPROCESSOR, VALIDATION, NORMALIZATION, DELTA, TRANSMISSION);

    /** Some stages (Validation in particular, in practice) append a run
     * `YYYYMMDD-HHMMSS[:runId]` timestamp after the file identity, e.g.
     * {@code ..._20260728-022520:349514}. Recognized wherever it appears, not just on
     * Validation, and captured separately rather than folded into the file name so it
     * doesn't fragment grouping between runs of the same file. */
    private static final Pattern RUN_TIMESTAMP = Pattern.compile("(\\d{8}-\\d{6})(?::\\d+)?");
    private static final DateTimeFormatter RUN_TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final String label;
    private final String keyword;

    PipelineStage(String label, String keyword) {
        this.label = label;
        this.keyword = keyword;
    }

    public String getLabel() {
        return label;
    }

    /** Returns the stage whose keyword appears in the given application name, or null if none match. */
    public static PipelineStage matchApplicationName(String applicationName) {
        if (applicationName == null) {
            return null;
        }
        String lower = applicationName.toLowerCase();
        for (PipelineStage stage : values()) {
            if (lower.contains(stage.keyword)) {
                return stage;
            }
        }
        return null;
    }

    /**
     * Application names are underscore-separated, starting with the stage keyword.
     * What follows varies in practice:
     * <ul>
     *   <li>{@code <Stage>_<fileName>_<YYYYMMDD>} — the simple case, no vendor prefix
     *       or file type token.</li>
     *   <li>{@code <Stage>_<vendor>_<fileName>.<fileType>.<YYYYMMDD>[_<runTimestamp>]}
     *       — the vendor-staging convention (the same {@code fileName.fileType.date}
     *       shape {@code S3TransferService} stages files under). Different stages of
     *       the same file don't always carry the same vendor prefix or run-timestamp
     *       suffix (e.g. a Normalization run might drop the prefix a Preprocessor/
     *       Validation run for the same file kept), so when this dot-form file token
     *       is found, it — not the surrounding tokens — is treated as the file's
     *       identity, which is what lets those runs still group as one file.</li>
     * </ul>
     */
    public static Extraction extract(String applicationName) {
        if (applicationName == null || applicationName.isBlank()) {
            return new Extraction(null, applicationName, null, null, null);
        }
        String[] rawParts = applicationName.split("_");
        if (rawParts.length < 2) {
            return new Extraction(matchApplicationName(applicationName), applicationName, null, null, null);
        }
        PipelineStage stage = matchApplicationName(rawParts[0]);
        List<String> parts = new ArrayList<>(Arrays.asList(rawParts).subList(1, rawParts.length));

        Long runTimestamp = null;
        for (int i = parts.size() - 1; i >= 0; i--) {
            Matcher m = RUN_TIMESTAMP.matcher(parts.get(i));
            if (m.matches()) {
                runTimestamp = parseRunTimestamp(m.group(1));
                parts.remove(i);
                break;
            }
        }

        for (int i = parts.size() - 1; i >= 0; i--) {
            String[] dotParts = parts.get(i).split("\\.");
            if (dotParts.length == 3 && dotParts[2].matches("\\d{8}")) {
                return new Extraction(stage, dotParts[0], dotParts[2], dotParts[1], runTimestamp);
            }
        }

        boolean hasTrailingDate = !parts.isEmpty() && parts.get(parts.size() - 1).matches("\\d{8}");
        String date = hasTrailingDate ? parts.get(parts.size() - 1) : null;
        List<String> coreParts = hasTrailingDate ? parts.subList(0, parts.size() - 1) : parts;
        String core = coreParts.isEmpty() ? applicationName : String.join("_", coreParts);
        return new Extraction(stage, core, date, null, runTimestamp);
    }

    private static Long parseRunTimestamp(String raw) {
        try {
            return LocalDateTime.parse(raw, RUN_TIMESTAMP_FORMAT).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /**
     * @param stage null if the leading token isn't a recognized stage keyword
     * @param fileType the middle segment of a {@code fileName.fileType.date} identity token, null if not present
     * @param runTimestamp epoch millis of an embedded run timestamp suffix, if one was found
     */
    public record Extraction(PipelineStage stage, String coreFileName, String date, String fileType, Long runTimestamp) {
    }
}

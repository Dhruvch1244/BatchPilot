package com.batchpilot.model;

import java.util.ArrayList;
import java.util.List;

/**
 * The stages of the batch file pipeline a YARN application name can belong to. Stage
 * membership is inferred heuristically from keywords in the application name (see
 * {@code StageTrackerService}) — there is no ground-truth pipeline-stage database
 * wired in, so this is an approximation, not an authoritative status.
 *
 * <p>Not every file goes through every stage — {@code OUTBOUND} in particular is
 * conditional (only some files have it) — so callers should only render stages that
 * actually have matches for a given file, not this full fixed list.
 */
public enum PipelineStage {
    PREPROCESSOR("Preprocessor", "preprocess"),
    VALIDATION("Validation", "valid"),
    NORMALIZATION("Normalization", "normal"),
    DELTA("Delta", "delta"),
    TRANSMISSION("Transmission", "transmi"),
    OUTBOUND("Outbound", "outbound");

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
     * Application names follow {@code <Stage>_<fileName>_<YYYYMMDD>} (the trailing date
     * is optional). Extracts the "core" file name — everything between the stage prefix
     * and the trailing date — by splitting on underscores rather than a regex, so file
     * names that themselves contain underscores are handled correctly (a greedy/lazy
     * regex group can't reliably tell "part of the file name" from "the date" when both
     * are underscore-separated).
     */
    public static Extraction extract(String applicationName) {
        if (applicationName == null || applicationName.isBlank()) {
            return new Extraction(null, applicationName, null);
        }
        String[] parts = applicationName.split("_");
        if (parts.length < 2) {
            return new Extraction(matchApplicationName(applicationName), applicationName, null);
        }
        PipelineStage stage = matchApplicationName(parts[0]);
        boolean hasTrailingDate = parts[parts.length - 1].matches("\\d{8}");
        int coreEnd = hasTrailingDate ? parts.length - 1 : parts.length;
        String date = hasTrailingDate ? parts[parts.length - 1] : null;

        List<String> coreParts = new ArrayList<>();
        for (int i = 1; i < coreEnd; i++) {
            coreParts.add(parts[i]);
        }
        String core = coreParts.isEmpty() ? applicationName : String.join("_", coreParts);
        return new Extraction(stage, core, date);
    }

    /** @param stage null if the leading token isn't a recognized stage keyword */
    public record Extraction(PipelineStage stage, String coreFileName, String date) {
    }
}

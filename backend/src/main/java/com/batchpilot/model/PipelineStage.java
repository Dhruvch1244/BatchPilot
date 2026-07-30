package com.batchpilot.model;

/**
 * The five stages of the batch file pipeline. Stage membership for a given YARN
 * application is inferred heuristically from keywords in its application name
 * (see {@code StageTrackerService}) — there is no ground-truth pipeline-stage
 * database wired in, so this is an approximation, not an authoritative status.
 */
public enum PipelineStage {
    PREPROCESSOR("Preprocessor", "preprocess"),
    VALIDATION("Validation", "valid"),
    NORMALIZATION("Normalization", "normal"),
    DAAF("Daaf", "daaf"),
    TRANSMISSION("Transmission", "transmi");

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
}

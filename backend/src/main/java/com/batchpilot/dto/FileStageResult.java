package com.batchpilot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One distinct file's pipeline view — a broad search can match several different
 * underlying files (e.g. searching "report" could hit both "monthly_report" and
 * "report_2026"), so results are grouped by the file name extracted from each
 * application's name, one {@code FileStageResult} per distinct file.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FileStageResult {
    private String coreFileName;
    /** Epoch millis of the most recent finish time across this file's matches, or null if none have finished. */
    private Long latestCompletedAt;
    /** Only stages that actually have at least one match, ordered by earliest observed start time. */
    private List<StageGroup> stages;
    private List<StageMatch> unclassifiedMatches;
}

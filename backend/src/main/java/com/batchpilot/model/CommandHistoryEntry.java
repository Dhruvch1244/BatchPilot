package com.batchpilot.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One past command execution (Quick Execute or S3 Transfer), persisted so the
 * command text survives closing the panel/tab or reconnecting - just the command and
 * its outcome, not the full stdout/stderr, which stays session-only (some commands'
 * output may be large or sensitive, and it's already shown live right after running). */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CommandHistoryEntry {
    private String id;
    private String environmentId;
    private String environmentName;
    private CommandHistorySource source;
    private String command;
    private boolean success;
    private int exitCode;
    private long durationMs;
    private long executedAt;
}

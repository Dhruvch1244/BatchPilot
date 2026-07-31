package com.batchpilot.model;

/** Which feature ran a persisted {@link CommandHistoryEntry} — Quick Execute's free-form
 * commands and S3 Transfer's generated {@code aws s3 cp} commands both funnel through
 * the same {@code QuickExecuteService#execute}, so this is how the two histories are
 * told apart when a caller only wants one of them. */
public enum CommandHistorySource {
    QUICK_EXECUTE,
    S3_TRANSFER
}

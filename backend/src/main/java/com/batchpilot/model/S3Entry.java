package com.batchpilot.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** One row in an S3 Explorer listing - either a "folder" (an S3 CommonPrefix, synthesized
 * by the {@code --delimiter /} listing, not a real object) or an actual object ("file"). */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class S3Entry {
    /** Full S3 key (or, for a directory, the common prefix - always ends in "/"). */
    private String key;
    /** Last path segment, for display - "reports/" for a directory, "file.csv" for an object. */
    private String name;
    private boolean directory;
    /** Null for directories - CommonPrefixes carry no size/timestamp of their own. */
    private Long size;
    private Instant lastModified;
}

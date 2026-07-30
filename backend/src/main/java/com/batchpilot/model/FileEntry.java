package com.batchpilot.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FileEntry {
    private String name;
    private String path;
    private boolean directory;
    private long size;
    private Instant lastModified;
    private String permissions;
}

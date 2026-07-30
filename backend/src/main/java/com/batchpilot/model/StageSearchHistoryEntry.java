package com.batchpilot.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StageSearchHistoryEntry {
    private String id;
    private String environmentId;
    private String environmentName;
    private String filename;
    private long searchedAt;
    private int matchCount;
    private Map<String, Integer> stageCounts;
}

package com.batchpilot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StageSearchResult {
    private String environmentId;
    private String filename;
    private long searchedAt;
    private List<StageGroup> stages;
    private List<StageMatch> unclassifiedMatches;
}

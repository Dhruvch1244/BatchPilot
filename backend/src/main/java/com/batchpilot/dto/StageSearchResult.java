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
    private String query;
    private long searchedAt;
    private List<FileStageResult> files;
}

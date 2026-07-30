package com.batchpilot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StageMatch {
    private String applicationId;
    private String applicationName;
    private String state;
    private String finalStatus;
    private Integer progressPercent;
    private String trackingUrl;
    private Long startTime;
    private Long finishTime;
    private long elapsedMs;
}

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
    /** Epoch millis of a run timestamp embedded in the application name (e.g.
     * Validation's {@code ..._20260728-022520:349514} suffix), or null if the name
     * didn't carry one. Distinct from startTime/finishTime, which come from YARN. */
    private Long runTimestamp;
}

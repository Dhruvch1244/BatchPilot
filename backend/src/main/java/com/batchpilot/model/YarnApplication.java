package com.batchpilot.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class YarnApplication {
    private String applicationId;
    private String applicationName;
    private String applicationType;
    private String user;
    private String queue;
    private String state;
    private String finalStatus;
    private Integer progressPercent;
    private String trackingUrl;
    /** Epoch millis; only populated when fetched via `yarn application -status` (single-application detail). */
    private Long startTime;
    private Long finishTime;
}

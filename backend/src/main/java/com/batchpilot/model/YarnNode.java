package com.batchpilot.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class YarnNode {
    private String nodeId;
    private String nodeState;
    private String nodeHttpAddress;
    private Integer runningContainers;
}

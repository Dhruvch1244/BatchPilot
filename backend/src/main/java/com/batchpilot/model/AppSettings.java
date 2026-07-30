package com.batchpilot.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AppSettings {

    private int fontSize = 14;
    private String theme = "dark";
    private boolean autoReconnect = true;
    private int reconnectIntervalSeconds = 5;
    private int maxReconnectAttempts = 5;
    private int maxTabs = 10;
    private long maxUploadSizeMb = 512;
}

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

    /** Terminal (xterm.js) font size in px. Kept separate from the UI font size below -
     * a terminal is usually read at a different density than the rest of the app chrome. */
    private int fontSize = 12;
    private String theme = "dark";
    private boolean autoReconnect = true;
    private int reconnectIntervalSeconds = 5;
    private int maxReconnectAttempts = 5;
    private int maxTabs = 15;
    private long maxUploadSizeMb = 2048;

    /** Ids into the frontend's curated font catalog (core/font-catalog.ts) - the backend
     * never interprets these, just persists whatever id the frontend sent. */
    private String uiFontFamily = "system";
    private String terminalFontFamily = "auto";
    private int uiFontSizePx = 12;
    private double uiLineHeight = 1.5;

    /** Overall UI density/zoom, as a percentage (100 = no scaling) - applied via CSS `zoom`
     * on the document root. Defaults below 100 for a denser, more compact layout out of the
     * box (less scrolling on smaller/corporate-laptop screens) without shrinking any single
     * font-size setting on its own. */
    private int uiScalePercent = 90;

    /** Whether the first-run setup wizard has already been shown (or explicitly skipped) -
     * flips to true the first time either happens, so it never reappears on a later launch. */
    private boolean onboardingCompleted = false;
}

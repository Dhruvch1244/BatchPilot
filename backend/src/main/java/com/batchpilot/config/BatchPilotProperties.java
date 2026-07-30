package com.batchpilot.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Binds the {@code batchpilot.*} settings from application.yml.
 */
@ConfigurationProperties(prefix = "batchpilot")
public class BatchPilotProperties {

    /** Directory where environments.json / settings.json live. */
    private String dataDir;

    /** Username used for all SSH connections; not user-editable in the UI. */
    private String defaultUsername = "hadoop";

    private List<Preset> presets = List.of();

    public String getDataDir() {
        return dataDir;
    }

    public void setDataDir(String dataDir) {
        this.dataDir = dataDir;
    }

    public String getDefaultUsername() {
        return defaultUsername;
    }

    public void setDefaultUsername(String defaultUsername) {
        this.defaultUsername = defaultUsername;
    }

    public List<Preset> getPresets() {
        return presets;
    }

    public void setPresets(List<Preset> presets) {
        this.presets = presets;
    }

    public static class Preset {
        private String name;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }
    }
}

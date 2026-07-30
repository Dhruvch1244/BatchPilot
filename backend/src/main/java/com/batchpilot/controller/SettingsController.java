package com.batchpilot.controller;

import com.batchpilot.model.AppSettings;
import com.batchpilot.service.SettingsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public AppSettings get() {
        return settingsService.get();
    }

    @PutMapping
    public AppSettings update(@RequestBody AppSettings settings) {
        return settingsService.update(settings);
    }
}

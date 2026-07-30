package com.batchpilot.service;

import com.batchpilot.model.AppSettings;
import com.batchpilot.repository.SettingsRepository;
import org.springframework.stereotype.Service;

@Service
public class SettingsService {

    private final SettingsRepository repository;

    public SettingsService(SettingsRepository repository) {
        this.repository = repository;
    }

    public AppSettings get() {
        return repository.get();
    }

    public AppSettings update(AppSettings settings) {
        return repository.save(settings);
    }
}

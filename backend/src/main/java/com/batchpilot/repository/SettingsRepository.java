package com.batchpilot.repository;

import com.batchpilot.model.AppSettings;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Local JSON-backed persistence for application settings (settings.json), loaded at
 * startup and written through on every update.
 */
@Repository
public class SettingsRepository {

    private static final Logger log = LoggerFactory.getLogger(SettingsRepository.class);

    private final Path dataDir;
    private final Path storeFile;
    private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    private AppSettings settings = new AppSettings();

    public SettingsRepository(Path dataDirectory) {
        this.dataDir = dataDirectory;
        this.storeFile = dataDirectory.resolve("settings.json");
    }

    @PostConstruct
    public void load() {
        lock.writeLock().lock();
        try {
            Files.createDirectories(dataDir);
            if (Files.exists(storeFile)) {
                settings = mapper.readValue(storeFile.toFile(), AppSettings.class);
                log.info("Loaded settings from {}", storeFile);
            } else {
                settings = new AppSettings();
                persist();
                log.info("No existing settings.json found; wrote defaults at {}", storeFile);
            }
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load settings from " + storeFile, e);
        } finally {
            lock.writeLock().unlock();
        }
    }

    public AppSettings get() {
        lock.readLock().lock();
        try {
            return settings;
        } finally {
            lock.readLock().unlock();
        }
    }

    public AppSettings save(AppSettings updated) {
        lock.writeLock().lock();
        try {
            settings = updated;
            persist();
            return settings;
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void persist() {
        try {
            mapper.writeValue(storeFile.toFile(), settings);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to persist settings to " + storeFile, e);
        }
    }
}

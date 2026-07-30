package com.batchpilot.repository;

import com.batchpilot.config.BatchPilotProperties;
import com.batchpilot.model.Environment;
import com.batchpilot.model.EnvironmentType;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Local JSON-backed persistence for saved environments. Loads {@code environments.json}
 * from the data directory at startup (seeding DEV/UAT presets on first run) and writes
 * through to disk on every mutation, so there is never an unsaved in-memory-only state.
 */
@Repository
public class EnvironmentRepository {

    private static final Logger log = LoggerFactory.getLogger(EnvironmentRepository.class);

    private final Path dataDir;
    private final Path storeFile;
    private final BatchPilotProperties properties;
    private final ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .enable(SerializationFeature.INDENT_OUTPUT);

    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private List<Environment> environments = new ArrayList<>();

    public EnvironmentRepository(Path dataDirectory, BatchPilotProperties properties) {
        this.dataDir = dataDirectory;
        this.storeFile = dataDirectory.resolve("environments.json");
        this.properties = properties;
    }

    @PostConstruct
    public void load() {
        lock.writeLock().lock();
        try {
            Files.createDirectories(dataDir);
            if (Files.exists(storeFile)) {
                Environment[] loaded = mapper.readValue(storeFile.toFile(), Environment[].class);
                environments = new ArrayList<>(List.of(loaded));
                log.info("Loaded {} environment(s) from {}", environments.size(), storeFile);
            } else {
                environments = new ArrayList<>(seedPresets());
                persist();
                log.info("No existing environments.json found; seeded {} preset(s) at {}", environments.size(), storeFile);
            }
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load environments from " + storeFile, e);
        } finally {
            lock.writeLock().unlock();
        }
    }

    private List<Environment> seedPresets() {
        List<Environment> presets = new ArrayList<>();
        for (BatchPilotProperties.Preset preset : properties.getPresets()) {
            Environment env = new Environment();
            env.setId(UUID.randomUUID().toString());
            env.setName(preset.getName());
            env.setType(EnvironmentType.valueOf(preset.getName().toUpperCase()));
            env.setServerIp("");
            env.setSshPort(22);
            env.setPpkPath("");
            env.setUsername(properties.getDefaultUsername());
            presets.add(env);
        }
        return presets;
    }

    public List<Environment> findAll() {
        lock.readLock().lock();
        try {
            return new ArrayList<>(environments);
        } finally {
            lock.readLock().unlock();
        }
    }

    public Optional<Environment> findById(String id) {
        lock.readLock().lock();
        try {
            return environments.stream().filter(e -> e.getId().equals(id)).findFirst();
        } finally {
            lock.readLock().unlock();
        }
    }

    public Environment save(Environment environment) {
        lock.writeLock().lock();
        try {
            environments.removeIf(e -> e.getId().equals(environment.getId()));
            environments.add(environment);
            persist();
            return environment;
        } finally {
            lock.writeLock().unlock();
        }
    }

    public boolean deleteById(String id) {
        lock.writeLock().lock();
        try {
            boolean removed = environments.removeIf(e -> e.getId().equals(id));
            if (removed) {
                persist();
            }
            return removed;
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void persist() {
        try {
            mapper.writeValue(storeFile.toFile(), environments);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to persist environments to " + storeFile, e);
        }
    }
}

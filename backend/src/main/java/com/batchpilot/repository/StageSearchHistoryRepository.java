package com.batchpilot.repository;

import com.batchpilot.config.BatchPilotProperties;
import com.batchpilot.model.StageSearchHistoryEntry;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Local JSON-backed persistence for the user's past file-stage-tracker searches
 * (search-history.json), following the same load-at-startup / write-through-on-every-
 * mutation pattern as {@link EnvironmentRepository}. Capped at {@link #MAX_ENTRIES} —
 * oldest entries are dropped first.
 */
@Repository
public class StageSearchHistoryRepository {

    private static final Logger log = LoggerFactory.getLogger(StageSearchHistoryRepository.class);
    private static final int MAX_ENTRIES = 100;

    private final Path dataDir;
    private final Path storeFile;
    private final ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .enable(SerializationFeature.INDENT_OUTPUT);

    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private List<StageSearchHistoryEntry> entries = new ArrayList<>();

    public StageSearchHistoryRepository(Path dataDirectory, BatchPilotProperties properties) {
        this.dataDir = dataDirectory;
        this.storeFile = dataDirectory.resolve("search-history.json");
    }

    @PostConstruct
    public void load() {
        lock.writeLock().lock();
        try {
            Files.createDirectories(dataDir);
            if (Files.exists(storeFile)) {
                StageSearchHistoryEntry[] loaded = mapper.readValue(storeFile.toFile(), StageSearchHistoryEntry[].class);
                entries = new ArrayList<>(List.of(loaded));
                log.info("Loaded {} stage search history entr(ies) from {}", entries.size(), storeFile);
            } else {
                entries = new ArrayList<>();
            }
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load search history from " + storeFile, e);
        } finally {
            lock.writeLock().unlock();
        }
    }

    /** Most recent first. */
    public List<StageSearchHistoryEntry> findAll() {
        lock.readLock().lock();
        try {
            List<StageSearchHistoryEntry> copy = new ArrayList<>(entries);
            copy.sort(Comparator.comparingLong(StageSearchHistoryEntry::getSearchedAt).reversed());
            return copy;
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Upserts by (environmentId, filename) — searching the same filename again refreshes
     * the existing entry (new timestamp/match counts) rather than piling up duplicates,
     * so the recent-searches list stays one row per filename.
     */
    public void add(StageSearchHistoryEntry entry) {
        lock.writeLock().lock();
        try {
            entries.removeIf(e -> e.getEnvironmentId().equals(entry.getEnvironmentId())
                    && e.getFilename().equalsIgnoreCase(entry.getFilename()));
            entries.add(entry);
            entries.sort(Comparator.comparingLong(StageSearchHistoryEntry::getSearchedAt).reversed());
            if (entries.size() > MAX_ENTRIES) {
                entries = new ArrayList<>(entries.subList(0, MAX_ENTRIES));
            }
            persist();
        } finally {
            lock.writeLock().unlock();
        }
    }

    public void clear() {
        lock.writeLock().lock();
        try {
            entries = new ArrayList<>();
            persist();
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void persist() {
        try {
            mapper.writeValue(storeFile.toFile(), entries);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to persist search history to " + storeFile, e);
        }
    }
}

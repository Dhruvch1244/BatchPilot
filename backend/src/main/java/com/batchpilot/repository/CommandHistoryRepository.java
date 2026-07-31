package com.batchpilot.repository;

import com.batchpilot.model.CommandHistoryEntry;
import com.batchpilot.model.CommandHistorySource;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
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
 * Local JSON-backed persistence for past Quick Execute / S3 Transfer command runs
 * (command-history.json), following the same load-at-startup / write-through-on-every-
 * mutation pattern as {@link StageSearchHistoryRepository}. Capped at {@link #MAX_ENTRIES}
 * total across both sources — oldest entries are dropped first.
 */
@Repository
public class CommandHistoryRepository {

    private static final Logger log = LoggerFactory.getLogger(CommandHistoryRepository.class);
    private static final int MAX_ENTRIES = 150;

    private final Path dataDir;
    private final Path storeFile;
    private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private List<CommandHistoryEntry> entries = new ArrayList<>();

    public CommandHistoryRepository(Path dataDirectory) {
        this.dataDir = dataDirectory;
        this.storeFile = dataDirectory.resolve("command-history.json");
    }

    @PostConstruct
    public void load() {
        lock.writeLock().lock();
        try {
            Files.createDirectories(dataDir);
            if (Files.exists(storeFile)) {
                CommandHistoryEntry[] loaded = mapper.readValue(storeFile.toFile(), CommandHistoryEntry[].class);
                entries = new ArrayList<>(List.of(loaded));
                log.info("Loaded {} command history entr(ies) from {}", entries.size(), storeFile);
            } else {
                entries = new ArrayList<>();
            }
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load command history from " + storeFile, e);
        } finally {
            lock.writeLock().unlock();
        }
    }

    /** Most recent first, optionally filtered to one source, capped at {@code limit}. */
    public List<CommandHistoryEntry> findAll(CommandHistorySource source, int limit) {
        lock.readLock().lock();
        try {
            return entries.stream()
                    .filter(e -> source == null || e.getSource() == source)
                    .sorted(Comparator.comparingLong(CommandHistoryEntry::getExecutedAt).reversed())
                    .limit(Math.max(limit, 0))
                    .toList();
        } finally {
            lock.readLock().unlock();
        }
    }

    public void add(CommandHistoryEntry entry) {
        lock.writeLock().lock();
        try {
            entries.add(entry);
            entries.sort(Comparator.comparingLong(CommandHistoryEntry::getExecutedAt).reversed());
            if (entries.size() > MAX_ENTRIES) {
                entries = new ArrayList<>(entries.subList(0, MAX_ENTRIES));
            }
            persist();
        } finally {
            lock.writeLock().unlock();
        }
    }

    public void clear(CommandHistorySource source) {
        lock.writeLock().lock();
        try {
            if (source == null) {
                entries = new ArrayList<>();
            } else {
                entries.removeIf(e -> e.getSource() == source);
            }
            persist();
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void persist() {
        try {
            mapper.writeValue(storeFile.toFile(), entries);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to persist command history to " + storeFile, e);
        }
    }
}

package com.batchpilot.repository;

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
 * Local JSON-backed persistence for saved S3 vendor names (vendors.json) used by the
 * S3 staging transfer panel — a flat, deduplicated, alphabetically-sorted list the user
 * builds up over time ("save itself always if entered once").
 */
@Repository
public class VendorRepository {

    private static final Logger log = LoggerFactory.getLogger(VendorRepository.class);

    private final Path dataDir;
    private final Path storeFile;
    private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    private List<String> vendors = new ArrayList<>();

    public VendorRepository(Path dataDirectory) {
        this.dataDir = dataDirectory;
        this.storeFile = dataDirectory.resolve("vendors.json");
    }

    @PostConstruct
    public void load() {
        lock.writeLock().lock();
        try {
            Files.createDirectories(dataDir);
            if (Files.exists(storeFile)) {
                String[] loaded = mapper.readValue(storeFile.toFile(), String[].class);
                vendors = new ArrayList<>(List.of(loaded));
                log.info("Loaded {} vendor name(s) from {}", vendors.size(), storeFile);
            } else {
                vendors = new ArrayList<>();
            }
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load vendors from " + storeFile, e);
        } finally {
            lock.writeLock().unlock();
        }
    }

    public List<String> findAll() {
        lock.readLock().lock();
        try {
            List<String> copy = new ArrayList<>(vendors);
            copy.sort(Comparator.naturalOrder());
            return copy;
        } finally {
            lock.readLock().unlock();
        }
    }

    public void add(String vendor) {
        lock.writeLock().lock();
        try {
            boolean exists = vendors.stream().anyMatch(v -> v.equalsIgnoreCase(vendor));
            if (!exists) {
                vendors.add(vendor);
                persist();
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    public void remove(String vendor) {
        lock.writeLock().lock();
        try {
            if (vendors.removeIf(v -> v.equalsIgnoreCase(vendor))) {
                persist();
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void persist() {
        try {
            mapper.writeValue(storeFile.toFile(), vendors);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to persist vendors to " + storeFile, e);
        }
    }
}

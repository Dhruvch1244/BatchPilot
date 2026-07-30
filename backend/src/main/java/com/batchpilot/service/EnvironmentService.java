package com.batchpilot.service;

import com.batchpilot.config.BatchPilotProperties;
import com.batchpilot.dto.EnvironmentRequest;
import com.batchpilot.exception.ResourceNotFoundException;
import com.batchpilot.model.Environment;
import com.batchpilot.repository.EnvironmentRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class EnvironmentService {

    private final EnvironmentRepository repository;
    private final BatchPilotProperties properties;

    public EnvironmentService(EnvironmentRepository repository, BatchPilotProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    public List<Environment> findAll() {
        return repository.findAll();
    }

    public Environment findById(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Environment not found: " + id));
    }

    public Environment create(EnvironmentRequest request) {
        Environment env = new Environment();
        env.setId(UUID.randomUUID().toString());
        applyRequest(env, request);
        env.setCreatedAt(Instant.now());
        env.setUpdatedAt(Instant.now());
        return repository.save(env);
    }

    public Environment update(String id, EnvironmentRequest request) {
        Environment existing = findById(id);
        applyRequest(existing, request);
        existing.setUpdatedAt(Instant.now());
        return repository.save(existing);
    }

    public Environment duplicate(String id) {
        Environment source = findById(id);
        Environment copy = new Environment();
        copy.setId(UUID.randomUUID().toString());
        copy.setName(nextCopyName(source.getName()));
        copy.setType(com.batchpilot.model.EnvironmentType.CUSTOM);
        copy.setServerIp(source.getServerIp());
        copy.setSshPort(source.getSshPort());
        copy.setPpkPath(source.getPpkPath());
        copy.setUsername(properties.getDefaultUsername());
        copy.setCreatedAt(Instant.now());
        copy.setUpdatedAt(Instant.now());
        return repository.save(copy);
    }

    public void delete(String id) {
        if (!repository.deleteById(id)) {
            throw new ResourceNotFoundException("Environment not found: " + id);
        }
    }

    private void applyRequest(Environment env, EnvironmentRequest request) {
        env.setName(request.getName());
        env.setType(request.getType());
        env.setServerIp(request.getServerIp());
        env.setSshPort(request.getSshPort());
        env.setPpkPath(request.getPpkPath());
        // Username is never taken from the client; always the configured default.
        env.setUsername(properties.getDefaultUsername());
    }

    private String nextCopyName(String originalName) {
        List<String> existingNames = repository.findAll().stream().map(Environment::getName).toList();
        String candidate = originalName + " (copy)";
        int counter = 2;
        while (existingNames.contains(candidate)) {
            candidate = originalName + " (copy " + counter + ")";
            counter++;
        }
        return candidate;
    }
}

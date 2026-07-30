package com.batchpilot.controller;

import com.batchpilot.dto.ConnectionStatusResponse;
import com.batchpilot.model.Environment;
import com.batchpilot.service.EnvironmentService;
import com.batchpilot.ssh.ManagedConnection;
import com.batchpilot.ssh.SshConnectionManager;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/environments/{id}/connection")
public class ConnectionController {

    private final SshConnectionManager connectionManager;
    private final EnvironmentService environmentService;

    public ConnectionController(SshConnectionManager connectionManager, EnvironmentService environmentService) {
        this.connectionManager = connectionManager;
        this.environmentService = environmentService;
    }

    @PostMapping("/connect")
    public ConnectionStatusResponse connect(@PathVariable String id) {
        Environment environment = environmentService.findById(id);
        ManagedConnection managed = connectionManager.connect(environment);
        return toResponse(managed);
    }

    @PostMapping("/disconnect")
    public ConnectionStatusResponse disconnect(@PathVariable String id) {
        connectionManager.disconnect(id);
        return toResponse(connectionManager.getStatus(id));
    }

    @PostMapping("/reconnect")
    public ConnectionStatusResponse reconnect(@PathVariable String id) {
        Environment environment = environmentService.findById(id);
        ManagedConnection managed = connectionManager.reconnect(environment);
        return toResponse(managed);
    }

    @GetMapping("/status")
    public ConnectionStatusResponse status(@PathVariable String id) {
        return toResponse(connectionManager.getStatus(id));
    }

    @GetMapping("/health")
    public ConnectionStatusResponse health(@PathVariable String id) {
        ManagedConnection managed = connectionManager.getStatus(id);
        ConnectionStatusResponse response = toResponse(managed);
        if (managed.isUsable()) {
            response.setLatencyMs(connectionManager.pingLatencyMs(id));
        }
        return response;
    }

    private ConnectionStatusResponse toResponse(ManagedConnection managed) {
        return new ConnectionStatusResponse(
                managed.getEnvironmentId(),
                managed.getState(),
                managed.getLastError(),
                null,
                managed.getConnectedSince() != null ? managed.getConnectedSince().toEpochMilli() : null
        );
    }
}

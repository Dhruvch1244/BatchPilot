package com.batchpilot.controller;

import com.batchpilot.dto.EnvironmentRequest;
import com.batchpilot.model.Environment;
import com.batchpilot.service.EnvironmentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/environments")
public class EnvironmentController {

    private final EnvironmentService environmentService;

    public EnvironmentController(EnvironmentService environmentService) {
        this.environmentService = environmentService;
    }

    @GetMapping
    public List<Environment> list() {
        return environmentService.findAll();
    }

    @GetMapping("/{id}")
    public Environment get(@PathVariable String id) {
        return environmentService.findById(id);
    }

    @PostMapping
    public ResponseEntity<Environment> create(@Valid @RequestBody EnvironmentRequest request) {
        return ResponseEntity.ok(environmentService.create(request));
    }

    @PutMapping("/{id}")
    public Environment update(@PathVariable String id, @Valid @RequestBody EnvironmentRequest request) {
        return environmentService.update(id, request);
    }

    @PostMapping("/{id}/duplicate")
    public Environment duplicate(@PathVariable String id) {
        return environmentService.duplicate(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        environmentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}

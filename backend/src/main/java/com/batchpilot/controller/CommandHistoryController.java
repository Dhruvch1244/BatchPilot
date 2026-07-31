package com.batchpilot.controller;

import com.batchpilot.model.CommandHistoryEntry;
import com.batchpilot.model.CommandHistorySource;
import com.batchpilot.repository.CommandHistoryRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Past Quick Execute / S3 Transfer command runs — see {@link CommandHistoryRepository}. */
@RestController
@RequestMapping("/api/command-history")
public class CommandHistoryController {

    private final CommandHistoryRepository repository;

    public CommandHistoryController(CommandHistoryRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<CommandHistoryEntry> history(
            @RequestParam(required = false) CommandHistorySource source,
            @RequestParam(defaultValue = "20") int limit) {
        return repository.findAll(source, limit);
    }

    @DeleteMapping
    public void clear(@RequestParam(required = false) CommandHistorySource source) {
        repository.clear(source);
    }
}

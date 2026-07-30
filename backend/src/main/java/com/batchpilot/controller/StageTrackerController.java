package com.batchpilot.controller;

import com.batchpilot.dto.StageSearchResult;
import com.batchpilot.model.StageSearchHistoryEntry;
import com.batchpilot.service.StageTrackerService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class StageTrackerController {

    private final StageTrackerService stageTrackerService;

    public StageTrackerController(StageTrackerService stageTrackerService) {
        this.stageTrackerService = stageTrackerService;
    }

    @GetMapping("/api/environments/{id}/stage-tracker/search")
    public StageSearchResult search(@PathVariable String id, @RequestParam String query) {
        return stageTrackerService.search(id, query);
    }

    @GetMapping("/api/stage-tracker/history")
    public List<StageSearchHistoryEntry> history(@RequestParam(defaultValue = "10") int limit) {
        return stageTrackerService.history(limit);
    }

    @DeleteMapping("/api/stage-tracker/history")
    public void clearHistory() {
        stageTrackerService.clearHistory();
    }
}

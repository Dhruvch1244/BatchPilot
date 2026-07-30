package com.batchpilot.controller;

import com.batchpilot.dto.YarnActionResponse;
import com.batchpilot.model.YarnApplication;
import com.batchpilot.service.YarnService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/environments/{id}/yarn")
public class YarnController {

    private final YarnService yarnService;

    public YarnController(YarnService yarnService) {
        this.yarnService = yarnService;
    }

    @GetMapping("/applications")
    public List<YarnApplication> listApplications(@PathVariable String id) {
        return yarnService.listApplications(id);
    }

    @GetMapping("/applications/{appId}")
    public YarnApplication getApplication(@PathVariable String id, @PathVariable String appId) {
        return yarnService.getStatus(id, appId);
    }

    @PostMapping("/applications/{appId}/kill")
    public YarnActionResponse kill(@PathVariable String id, @PathVariable String appId) {
        return yarnService.kill(id, appId);
    }

    @GetMapping("/applications/{appId}/logs")
    public Map<String, String> logs(@PathVariable String id, @PathVariable String appId,
                                     @RequestParam(required = false) Integer lines) {
        return Map.of("logs", yarnService.getLogs(id, appId, lines));
    }
}

package com.batchpilot.controller;

import com.batchpilot.dto.YarnActionResponse;
import com.batchpilot.model.YarnApplication;
import com.batchpilot.model.YarnNode;
import com.batchpilot.service.YarnService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.nio.charset.StandardCharsets;
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

    /** Streams the (optionally size-capped and grep-filtered) log to the browser as a file
     * download — never buffered in memory, since these can run past 24 GB. */
    @GetMapping("/applications/{appId}/logs/download")
    public ResponseEntity<StreamingResponseBody> downloadLogs(@PathVariable String id, @PathVariable String appId,
                                                                @RequestParam(required = false) Long sizeLimitMb,
                                                                @RequestParam(required = false) String grep,
                                                                @RequestParam(defaultValue = "true") boolean caseInsensitive) {
        StreamingResponseBody body = out -> yarnService.streamLogDownload(id, appId, sizeLimitMb, grep, caseInsensitive, out);
        String fileName = appId + "-logs.txt";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(fileName, StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.TEXT_PLAIN)
                .body(body);
    }

    @GetMapping("/nodes")
    public List<YarnNode> listNodes(@PathVariable String id) {
        return yarnService.listNodes(id);
    }

    @GetMapping("/queues/{queueName}")
    public Map<String, String> queueStatus(@PathVariable String id, @PathVariable String queueName) {
        return Map.of("output", yarnService.queueStatus(id, queueName));
    }

    @GetMapping("/applications/{appId}/attempts")
    public Map<String, String> applicationAttempts(@PathVariable String id, @PathVariable String appId) {
        return Map.of("output", yarnService.applicationAttempts(id, appId));
    }

    @GetMapping("/attempts/{attemptId}/containers")
    public Map<String, String> containers(@PathVariable String id, @PathVariable String attemptId) {
        return Map.of("output", yarnService.containers(id, attemptId));
    }
}

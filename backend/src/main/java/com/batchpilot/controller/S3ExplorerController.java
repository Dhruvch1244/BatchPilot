package com.batchpilot.controller;

import com.batchpilot.dto.S3ListResult;
import com.batchpilot.service.S3ExplorerService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/environments/{id}/s3-explorer")
public class S3ExplorerController {

    private final S3ExplorerService s3ExplorerService;

    public S3ExplorerController(S3ExplorerService s3ExplorerService) {
        this.s3ExplorerService = s3ExplorerService;
    }

    @GetMapping
    public S3ListResult list(@PathVariable String id,
                              @RequestParam(required = false) String bucket,
                              @RequestParam(required = false) String prefix,
                              @RequestParam(required = false) String continuationToken,
                              @RequestParam(required = false) Integer pageSize) {
        return s3ExplorerService.list(id, bucket, prefix, continuationToken, pageSize);
    }

    @GetMapping("/download")
    public ResponseEntity<StreamingResponseBody> download(@PathVariable String id,
                                                            @RequestParam(required = false) String bucket,
                                                            @RequestParam String key) {
        String fileName = key.contains("/") ? key.substring(key.lastIndexOf('/') + 1) : key;
        StreamingResponseBody body = out -> s3ExplorerService.download(id, bucket, key, out);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(fileName, StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(body);
    }

    /** Uploads one or more files (drag-and-drop or multi-select) into the given bucket/prefix. */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> upload(@PathVariable String id,
                                       @RequestParam(required = false) String bucket,
                                       @RequestParam(required = false) String prefix,
                                       @RequestParam("files") List<MultipartFile> files) {
        Map<String, String> results = new LinkedHashMap<>();
        for (MultipartFile file : files) {
            try {
                s3ExplorerService.upload(id, bucket, prefix, file.getOriginalFilename(), file.getInputStream());
                results.put(file.getOriginalFilename(), "success");
            } catch (Exception e) {
                results.put(file.getOriginalFilename(), "failed: " + e.getMessage());
            }
        }
        return results;
    }
}

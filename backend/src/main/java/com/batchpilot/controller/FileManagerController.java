package com.batchpilot.controller;

import com.batchpilot.model.FileEntry;
import com.batchpilot.service.FileManagerService;
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
@RequestMapping("/api/environments/{id}/files")
public class FileManagerController {

    private final FileManagerService fileManagerService;

    public FileManagerController(FileManagerService fileManagerService) {
        this.fileManagerService = fileManagerService;
    }

    @GetMapping
    public List<FileEntry> list(@PathVariable String id,
                                 @RequestParam(defaultValue = ".") String path,
                                 @RequestParam(required = false) String search) {
        return fileManagerService.list(id, path, search);
    }

    @GetMapping("/download")
    public ResponseEntity<StreamingResponseBody> download(@PathVariable String id, @RequestParam String path) {
        String fileName = path.contains("/") ? path.substring(path.lastIndexOf('/') + 1) : path;
        StreamingResponseBody body = out -> fileManagerService.download(id, path, out);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(fileName, StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(body);
    }

    /** Uploads one or more files (drag-and-drop or multi-select) into the given remote directory. */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> upload(@PathVariable String id,
                                       @RequestParam String path,
                                       @RequestParam("files") List<MultipartFile> files) {
        Map<String, String> results = new LinkedHashMap<>();
        for (MultipartFile file : files) {
            try {
                fileManagerService.upload(id, path, file.getOriginalFilename(), file.getInputStream());
                results.put(file.getOriginalFilename(), "success");
            } catch (Exception e) {
                results.put(file.getOriginalFilename(), "failed: " + e.getMessage());
            }
        }
        return results;
    }
}

package com.batchpilot.controller;

import com.batchpilot.service.KeyStorageService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/** Backs the environment form's PPK file picker/dropper - see {@link KeyStorageService}. */
@RestController
@RequestMapping("/api/keys")
public class KeyStorageController {

    private final KeyStorageService keyStorageService;

    public KeyStorageController(KeyStorageService keyStorageService) {
        this.keyStorageService = keyStorageService;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> upload(@RequestParam("file") MultipartFile file) throws IOException {
        String path = keyStorageService.save(file.getOriginalFilename(), file.getInputStream());
        return Map.of("path", path);
    }
}

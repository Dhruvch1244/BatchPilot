package com.batchpilot.controller;

import com.batchpilot.dto.QuickExecuteResponse;
import com.batchpilot.dto.S3CopyRequest;
import com.batchpilot.service.S3TransferService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/environments/{id}/s3-transfer")
public class S3TransferController {

    private final S3TransferService s3TransferService;

    public S3TransferController(S3TransferService s3TransferService) {
        this.s3TransferService = s3TransferService;
    }

    @PostMapping
    public QuickExecuteResponse run(@PathVariable String id, @Valid @RequestBody S3CopyRequest request) {
        return s3TransferService.run(id, request);
    }
}

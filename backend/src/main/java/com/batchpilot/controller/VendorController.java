package com.batchpilot.controller;

import com.batchpilot.service.S3TransferService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/vendors")
public class VendorController {

    private final S3TransferService s3TransferService;

    public VendorController(S3TransferService s3TransferService) {
        this.s3TransferService = s3TransferService;
    }

    @GetMapping
    public List<String> list() {
        return s3TransferService.listVendors();
    }

    @PostMapping
    public List<String> add(@RequestBody Map<String, String> body) {
        return s3TransferService.addVendor(body.get("name"));
    }

    @DeleteMapping("/{name}")
    public List<String> remove(@PathVariable String name) {
        return s3TransferService.removeVendor(name);
    }
}

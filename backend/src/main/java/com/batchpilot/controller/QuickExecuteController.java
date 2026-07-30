package com.batchpilot.controller;

import com.batchpilot.dto.QuickExecuteRequest;
import com.batchpilot.dto.QuickExecuteResponse;
import com.batchpilot.service.QuickExecuteService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/quick-execute")
public class QuickExecuteController {

    private final QuickExecuteService quickExecuteService;

    public QuickExecuteController(QuickExecuteService quickExecuteService) {
        this.quickExecuteService = quickExecuteService;
    }

    @PostMapping
    public QuickExecuteResponse execute(@Valid @RequestBody QuickExecuteRequest request) {
        return quickExecuteService.execute(request);
    }
}

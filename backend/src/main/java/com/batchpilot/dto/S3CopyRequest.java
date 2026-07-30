package com.batchpilot.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class S3CopyRequest {

    @NotBlank
    private String vendorName;

    @NotBlank
    private String fileName;

    /** One of: out, dif, px. */
    @NotBlank
    private String fileType;

    /** ISO date (yyyy-MM-dd) from the date picker; formatted to YYYYMMDD when building the command. */
    @NotBlank
    private String date;

    /** Optional extra arguments (e.g. a destination path) appended after the source URI. */
    private String extraArgs;
}

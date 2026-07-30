package com.batchpilot.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class S3CopyRequest {

    /** Path to the source file on this environment (either typed directly, or the remote
     * path a local file was just uploaded to via the File Manager's upload endpoint). */
    @NotBlank
    private String sourcePath;

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

    /** Optional extra `aws s3 cp` flags (e.g. --sse, --acl) appended after the destination URI. */
    private String extraArgs;
}

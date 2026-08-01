package com.batchpilot.dto;

import com.batchpilot.model.S3Entry;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** One page of an S3 Explorer listing. {@code nextToken} is null once there's nothing more
 * to load - present, it's opaque (straight from the AWS CLI's own {@code NextToken}) and
 * meant to be echoed back as {@code continuationToken} on the next request, not parsed. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class S3ListResult {
    private String bucket;
    private String prefix;
    private List<S3Entry> entries;
    private String nextToken;
}

package com.batchpilot.service;

import com.batchpilot.dto.QuickExecuteRequest;
import com.batchpilot.dto.QuickExecuteResponse;
import com.batchpilot.dto.S3CopyRequest;
import com.batchpilot.repository.VendorRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Builds and runs the DAAF staging S3 upload command:
 * {@code aws s3 cp <sourcePath> s3://$S3_BUCKET/daaf-staging/<vendor>/<fileName>.<type>.<YYYYMMDD>}
 * over the environment's existing SSH session. The source is a path to a file already on
 * that environment — either typed directly (e.g. a path on the EMR box) or the remote path
 * a local file was just uploaded to via the File Manager's upload endpoint, from the
 * frontend's "attach a local file" flow. {@code $S3_BUCKET} is left unexpanded so the
 * remote shell resolves it from whatever is set in that environment — this service never
 * substitutes it client-side.
 *
 * <p>Every piece that lands in the command string is either checked against a strict
 * character allowlist or shell-quoted first: this runs through the same
 * exec-channel-over-a-real-shell path as Quick Execute, so anything not handled is a
 * command injection vector.
 */
@Service
public class S3TransferService {

    private static final Set<String> FILE_TYPES = Set.of("out", "dif", "px");
    private static final Pattern VENDOR_PATTERN = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$");
    private static final Pattern FILENAME_PATTERN = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$");
    private static final Pattern EXTRA_ARGS_PATTERN = Pattern.compile("^[A-Za-z0-9_\\-./: ]*$");
    private static final DateTimeFormatter COMMAND_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final QuickExecuteService quickExecuteService;
    private final VendorRepository vendorRepository;

    public S3TransferService(QuickExecuteService quickExecuteService, VendorRepository vendorRepository) {
        this.quickExecuteService = quickExecuteService;
        this.vendorRepository = vendorRepository;
    }

    public List<String> listVendors() {
        return vendorRepository.findAll();
    }

    public List<String> addVendor(String vendor) {
        String trimmed = requireValid(vendor, VENDOR_PATTERN, "vendor name");
        vendorRepository.add(trimmed);
        return vendorRepository.findAll();
    }

    public List<String> removeVendor(String vendor) {
        vendorRepository.remove(vendor);
        return vendorRepository.findAll();
    }

    public QuickExecuteResponse run(String environmentId, S3CopyRequest request) {
        String sourcePath = request.getSourcePath() == null ? "" : request.getSourcePath().strip();
        if (sourcePath.isEmpty()) {
            throw new IllegalArgumentException("Source path is required");
        }
        String vendor = requireValid(request.getVendorName(), VENDOR_PATTERN, "vendor name");
        String fileName = requireValid(request.getFileName(), FILENAME_PATTERN, "file name");
        String fileType = request.getFileType() == null ? "" : request.getFileType().strip().toLowerCase();
        if (!FILE_TYPES.contains(fileType)) {
            throw new IllegalArgumentException("File type must be one of: out, dif, px");
        }
        String dateSuffix = formatDate(request.getDate());
        String extraArgs = request.getExtraArgs() == null ? "" : request.getExtraArgs().strip();
        if (!extraArgs.isEmpty() && !EXTRA_ARGS_PATTERN.matcher(extraArgs).matches()) {
            throw new IllegalArgumentException(
                    "Extra arguments may only contain letters, numbers, and . _ - / : and spaces");
        }
        // A user-saved vendor is trusted to persist automatically per the feature request.
        vendorRepository.add(vendor);

        String destination = "s3://$S3_BUCKET/daaf-staging/" + vendor + "/" + fileName + "." + fileType + "." + dateSuffix;
        String command = "aws s3 cp " + shellQuote(sourcePath) + " " + destination
                + (extraArgs.isEmpty() ? "" : " " + extraArgs);

        QuickExecuteRequest execRequest = new QuickExecuteRequest();
        execRequest.setEnvironmentId(environmentId);
        execRequest.setCommand(command);
        execRequest.setTimeoutSeconds(120);
        return quickExecuteService.execute(execRequest);
    }

    private String requireValid(String value, Pattern pattern, String label) {
        String trimmed = value == null ? "" : value.strip();
        if (!pattern.matcher(trimmed).matches()) {
            throw new IllegalArgumentException(
                    "Invalid " + label + ": only letters, numbers, '.', '_', '-' are allowed, and it can't be empty");
        }
        return trimmed;
    }

    /** Wraps in single quotes for safe interpolation into a remote shell command, escaping any
     * embedded single quotes — standard `'\''` POSIX-shell technique. Used for the source path
     * rather than a character allowlist since it needs to accept arbitrary uploaded file names
     * (spaces, unicode, ...), unlike the short typed fields above. */
    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\\''") + "'";
    }

    private String formatDate(String isoDate) {
        try {
            return LocalDate.parse(isoDate).format(COMMAND_DATE_FORMAT);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Invalid date: expected yyyy-MM-dd");
        }
    }
}

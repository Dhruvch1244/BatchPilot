package com.batchpilot.service;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.regex.Pattern;

/**
 * Saves a PPK private key picked through the browser's file dialog into the app's own
 * local data directory, so the environment form can be given a real filesystem path
 * afterward. Browsers never expose a picked file's true absolute path to a web
 * page - only its name, for security - so there's no way to just point
 * {@code ppkPath} at wherever the user's original file already lives; the file has to
 * be copied somewhere BatchPilot can name first.
 *
 * <p>Saved alongside the app's other local state under {@code ~/.batchpilot/keys/},
 * never transmitted anywhere except later to whichever SSH server it's used to
 * authenticate against - same as a key the user typed a path to directly.
 */
@Service
public class KeyStorageService {

    private static final Pattern UNSAFE_FILENAME_CHARS = Pattern.compile("[^A-Za-z0-9._-]");

    private final Path keysDir;

    public KeyStorageService(Path dataDirectory) {
        this.keysDir = dataDirectory.resolve("keys");
    }

    /** Returns the absolute path the key was saved to. Prefixed with a timestamp so
     * uploading two keys that happen to share a file name (e.g. two environments both
     * using "id_rsa.ppk") doesn't silently overwrite one with the other. */
    public String save(String originalFilename, InputStream content) throws IOException {
        Files.createDirectories(keysDir);
        String safeName = sanitize(originalFilename);
        Path target = keysDir.resolve(Instant.now().toEpochMilli() + "-" + safeName);
        Files.copy(content, target, StandardCopyOption.REPLACE_EXISTING);
        return target.toAbsolutePath().toString();
    }

    private String sanitize(String name) {
        String base = (name == null || name.isBlank()) ? "key.ppk" : Path.of(name).getFileName().toString();
        String cleaned = UNSAFE_FILENAME_CHARS.matcher(base).replaceAll("_");
        return cleaned.isBlank() ? "key.ppk" : cleaned;
    }
}

package com.batchpilot.ssh;

import com.batchpilot.exception.SshOperationException;
import org.apache.sshd.common.NamedResource;
import org.apache.sshd.common.config.keys.FilePasswordProvider;
import org.apache.sshd.putty.PuttyKeyUtils;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.util.Collection;

/**
 * Loads PuTTY {@code .ppk} private keys from disk for use in SSH authentication.
 *
 * <p>Only a filesystem path is ever accepted, and the parsed {@link KeyPair} is handed
 * directly to the SSH client in memory. Key material is never logged, never echoed back
 * in any API response, and never written anywhere other than the source .ppk file itself.
 */
@Service
public class PpkKeyService {

    public KeyPair loadKeyPair(String ppkPath) {
        Path path = Path.of(ppkPath);
        if (!Files.isReadable(path)) {
            throw new SshOperationException("PPK file not found or unreadable: " + path);
        }
        NamedResource resource = NamedResource.ofName(path.getFileName().toString());
        try (InputStream in = Files.newInputStream(path)) {
            Collection<KeyPair> pairs = PuttyKeyUtils.DEFAULT_INSTANCE.loadKeyPairs(
                    null, resource, FilePasswordProvider.EMPTY, in);
            if (pairs.isEmpty()) {
                throw new SshOperationException("No key pair could be parsed from PPK file: " + path.getFileName());
            }
            return pairs.iterator().next();
        } catch (IOException | GeneralSecurityException e) {
            throw new SshOperationException(
                    "Failed to parse PPK file " + path.getFileName() + ": " + e.getMessage(), e);
        }
    }
}

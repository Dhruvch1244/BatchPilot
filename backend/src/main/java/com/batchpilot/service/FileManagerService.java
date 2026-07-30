package com.batchpilot.service;

import com.batchpilot.exception.SshOperationException;
import com.batchpilot.model.FileEntry;
import com.batchpilot.ssh.SshConnectionManager;
import org.apache.sshd.client.session.ClientSession;
import org.apache.sshd.sftp.client.SftpClient;
import org.apache.sshd.sftp.client.SftpClientFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Remote file browsing and transfer over SFTP for an already-connected environment.
 * Every call opens a short-lived SFTP client on top of the environment's shared SSH
 * session and closes it once the operation completes.
 */
@Service
public class FileManagerService {

    private final SshConnectionManager connectionManager;

    public FileManagerService(SshConnectionManager connectionManager) {
        this.connectionManager = connectionManager;
    }

    public List<FileEntry> list(String environmentId, String remotePath, String searchQuery) {
        String path = normalize(remotePath);
        try (SftpClient sftp = openSftp(environmentId)) {
            List<FileEntry> entries = new ArrayList<>();
            for (SftpClient.DirEntry dirEntry : sftp.readDir(path)) {
                String name = dirEntry.getFilename();
                if (".".equals(name) || "..".equals(name)) {
                    continue;
                }
                if (searchQuery != null && !searchQuery.isBlank()
                        && !name.toLowerCase().contains(searchQuery.toLowerCase())) {
                    continue;
                }
                entries.add(toFileEntry(path, dirEntry));
            }
            entries.sort(Comparator.comparing(FileEntry::isDirectory).reversed()
                    .thenComparing(FileEntry::getName, String.CASE_INSENSITIVE_ORDER));
            return entries;
        } catch (IOException e) {
            throw new SshOperationException("Failed to list " + path + ": " + e.getMessage(), e);
        }
    }

    public void download(String environmentId, String remotePath, OutputStream destination) {
        try (SftpClient sftp = openSftp(environmentId);
             InputStream in = sftp.read(remotePath)) {
            in.transferTo(destination);
        } catch (IOException e) {
            throw new SshOperationException("Failed to download " + remotePath + ": " + e.getMessage(), e);
        }
    }

    public void upload(String environmentId, String remoteDirectory, String fileName, InputStream data) {
        String targetPath = joinPath(remoteDirectory, fileName);
        try (SftpClient sftp = openSftp(environmentId);
             OutputStream out = sftp.write(targetPath,
                     SftpClient.OpenMode.Create, SftpClient.OpenMode.Write, SftpClient.OpenMode.Truncate)) {
            data.transferTo(out);
        } catch (IOException e) {
            throw new SshOperationException("Failed to upload " + fileName + ": " + e.getMessage(), e);
        }
    }

    private SftpClient openSftp(String environmentId) throws IOException {
        ClientSession session = connectionManager.getActiveSession(environmentId);
        return SftpClientFactory.instance().createSftpClient(session);
    }

    private String normalize(String path) {
        return (path == null || path.isBlank()) ? "." : path;
    }

    private String joinPath(String directory, String name) {
        String dir = normalize(directory);
        return dir.endsWith("/") ? dir + name : dir + "/" + name;
    }

    private FileEntry toFileEntry(String parentPath, SftpClient.DirEntry dirEntry) {
        SftpClient.Attributes attrs = dirEntry.getAttributes();
        FileEntry entry = new FileEntry();
        entry.setName(dirEntry.getFilename());
        entry.setPath(joinPath(parentPath, dirEntry.getFilename()));
        entry.setDirectory(attrs.isDirectory());
        entry.setSize(attrs.getSize());
        entry.setLastModified(attrs.getModifyTime() != null ? attrs.getModifyTime().toInstant() : null);
        entry.setPermissions(Integer.toOctalString(attrs.getPermissions() & 0777));
        return entry;
    }
}

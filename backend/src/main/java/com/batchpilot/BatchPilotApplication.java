package com.batchpilot;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.IOException;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

@SpringBootApplication
public class BatchPilotApplication {

    private static final Logger log = LoggerFactory.getLogger(BatchPilotApplication.class);
    private static final int DEFAULT_PORT = 8743;
    private static final int MAX_PORT_ATTEMPTS = 50;

    public static void main(String[] args) {
        int resolvedPort = resolvePort();
        System.setProperty("server.port", String.valueOf(resolvedPort));
        writePortFile(resolvedPort);
        SpringApplication.run(BatchPilotApplication.class, args);
    }

    /**
     * The packaged launcher scripts (packaging/) point a browser at a fixed port by
     * default, but on a shared/corporate machine that port can already be taken by
     * something else - rather than Spring Boot failing to bind and the app not
     * starting at all, this probes forward from the desired port and uses the first
     * one that's actually free, writing it to a well-known file (see writePortFile)
     * so those scripts still know which URL to open regardless of which port won.
     *
     * <p>This is a best-effort pre-check, not a guarantee: another process could grab
     * the chosen port in the brief window between this check and Tomcat's own bind.
     * That's an acceptable, extremely unlikely race for a desktop app - not worth the
     * complexity of hooking into the embedded server's own bind-failure/retry cycle.
     */
    private static int resolvePort() {
        int desired = desiredPort();
        for (int port = desired; port < desired + MAX_PORT_ATTEMPTS; port++) {
            if (isAvailable(port)) {
                if (port != desired) {
                    log.warn("Port {} was already in use; starting on port {} instead.", desired, port);
                }
                return port;
            }
        }
        log.warn("No free port found in {}-{}; falling back to {} and letting startup fail if it's still taken.",
                desired, desired + MAX_PORT_ATTEMPTS - 1, desired);
        return desired;
    }

    /** Respects an explicit override (system property or env var) the same way Spring
     * Boot's own config resolution would, before falling back to the packaged default -
     * this all runs before the Spring context exists, so it can't just @Value it. */
    private static int desiredPort() {
        String configured = System.getProperty("server.port");
        if (configured == null || configured.isBlank()) {
            configured = System.getenv("SERVER_PORT");
        }
        if (configured != null && !configured.isBlank()) {
            try {
                return Integer.parseInt(configured.trim());
            } catch (NumberFormatException e) {
                log.warn("Ignoring invalid server.port value '{}', using default {}", configured, DEFAULT_PORT);
            }
        }
        return DEFAULT_PORT;
    }

    private static boolean isAvailable(int port) {
        try (ServerSocket socket = new ServerSocket(port)) {
            socket.setReuseAddress(true);
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    /** Written to ~/.batchpilot/port.txt - the same directory the app already keeps
     * its other local state in - so the packaged launcher scripts (which run before
     * and independently of the JVM logging any of this) know which port to open a
     * browser to without having to parse startup logs. */
    private static void writePortFile(int port) {
        try {
            Path dataDir = Path.of(System.getProperty("user.home"), ".batchpilot");
            Files.createDirectories(dataDir);
            Files.writeString(dataDir.resolve("port.txt"), String.valueOf(port), StandardCharsets.UTF_8);
        } catch (IOException e) {
            log.warn("Failed to write port.txt (launcher scripts may not find the right port): {}", e.getMessage());
        }
    }
}

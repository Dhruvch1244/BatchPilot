package com.batchpilot.ssh;

import com.batchpilot.exception.SshOperationException;
import com.batchpilot.model.AppSettings;
import com.batchpilot.model.ConnectionState;
import com.batchpilot.model.Environment;
import com.batchpilot.repository.EnvironmentRepository;
import com.batchpilot.repository.SettingsRepository;
import jakarta.annotation.PreDestroy;
import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.channel.ChannelExec;
import org.apache.sshd.client.channel.ClientChannelEvent;
import org.apache.sshd.client.session.ClientSession;
import org.apache.sshd.common.session.Session;
import org.apache.sshd.common.session.SessionListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.security.KeyPair;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Owns the lifecycle of every environment's SSH session: connect, disconnect,
 * reconnect, health checks and (when enabled in settings) automatic reconnection
 * after an unexpected drop.
 */
@Service
public class SshConnectionManager {

    private static final Logger log = LoggerFactory.getLogger(SshConnectionManager.class);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(15);
    private static final Duration AUTH_TIMEOUT = Duration.ofSeconds(15);

    private final SshClientProvider clientProvider;
    private final PpkKeyService ppkKeyService;
    private final EnvironmentRepository environmentRepository;
    private final SettingsRepository settingsRepository;

    private final Map<String, ManagedConnection> connections = new ConcurrentHashMap<>();
    private final ScheduledExecutorService reconnectExecutor =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "batchpilot-reconnect");
                t.setDaemon(true);
                return t;
            });

    public SshConnectionManager(SshClientProvider clientProvider,
                                 PpkKeyService ppkKeyService,
                                 EnvironmentRepository environmentRepository,
                                 SettingsRepository settingsRepository) {
        this.clientProvider = clientProvider;
        this.ppkKeyService = ppkKeyService;
        this.environmentRepository = environmentRepository;
        this.settingsRepository = settingsRepository;
    }

    public synchronized ManagedConnection connect(Environment environment) {
        String id = environment.getId();
        ManagedConnection managed = connections.computeIfAbsent(id, ManagedConnection::new);
        if (managed.isUsable()) {
            return managed;
        }
        managed.setManualDisconnect(false);
        managed.setState(ConnectionState.CONNECTING);
        try {
            ClientSession session = openSession(environment);
            managed.setSession(session);
            managed.setState(ConnectionState.CONNECTED);
            managed.setConnectedSince(Instant.now());
            managed.setLastError(null);
            managed.getReconnectAttempts().set(0);
            registerListener(managed);
            log.info("Connected to environment {} ({}:{})", environment.getName(), environment.getServerIp(), environment.getSshPort());
            return managed;
        } catch (Exception e) {
            managed.setState(ConnectionState.ERROR);
            managed.setLastError(e.getMessage());
            log.warn("Failed to connect to environment {}: {}", environment.getName(), e.getMessage());
            throw new SshOperationException("Failed to connect to " + environment.getServerIp() + ": " + e.getMessage(), e);
        }
    }

    private ClientSession openSession(Environment environment) throws Exception {
        SshClient client = clientProvider.getClient();
        KeyPair keyPair = ppkKeyService.loadKeyPair(environment.getPpkPath());

        ClientSession session = client.connect(environment.getUsername(), environment.getServerIp(), environment.getSshPort())
                .verify(CONNECT_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)
                .getSession();
        session.addPublicKeyIdentity(keyPair);
        session.auth().verify(AUTH_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
        return session;
    }

    private void registerListener(ManagedConnection managed) {
        managed.getSession().addSessionListener(new SessionListener() {
            @Override
            public void sessionClosed(Session session) {
                if (managed.getSession() != session) {
                    return;
                }
                if (managed.isManualDisconnect()) {
                    managed.setState(ConnectionState.DISCONNECTED);
                    return;
                }
                managed.setState(ConnectionState.ERROR);
                managed.setLastError("Connection dropped unexpectedly");
                log.warn("Connection to environment {} dropped unexpectedly", managed.getEnvironmentId());
                maybeScheduleReconnect(managed);
            }
        });
    }

    private void maybeScheduleReconnect(ManagedConnection managed) {
        AppSettings settings = settingsRepository.get();
        if (!settings.isAutoReconnect()) {
            return;
        }
        int attempt = managed.getReconnectAttempts().incrementAndGet();
        if (attempt > settings.getMaxReconnectAttempts()) {
            log.warn("Giving up reconnecting to environment {} after {} attempt(s)", managed.getEnvironmentId(), attempt - 1);
            return;
        }
        managed.setState(ConnectionState.RECONNECTING);
        reconnectExecutor.schedule(() -> attemptReconnect(managed, attempt),
                settings.getReconnectIntervalSeconds(), TimeUnit.SECONDS);
    }

    private void attemptReconnect(ManagedConnection managed, int attempt) {
        environmentRepository.findById(managed.getEnvironmentId()).ifPresentOrElse(env -> {
            try {
                log.info("Reconnect attempt {} for environment {}", attempt, env.getName());
                ClientSession session = openSession(env);
                managed.setSession(session);
                managed.setState(ConnectionState.CONNECTED);
                managed.setConnectedSince(Instant.now());
                managed.setLastError(null);
                managed.getReconnectAttempts().set(0);
                registerListener(managed);
                log.info("Reconnected to environment {}", env.getName());
            } catch (Exception e) {
                managed.setLastError(e.getMessage());
                log.warn("Reconnect attempt {} for environment {} failed: {}", attempt, env.getName(), e.getMessage());
                maybeScheduleReconnect(managed);
            }
        }, () -> managed.setState(ConnectionState.ERROR));
    }

    public synchronized void disconnect(String environmentId) {
        ManagedConnection managed = connections.get(environmentId);
        if (managed == null) {
            return;
        }
        managed.setManualDisconnect(true);
        ClientSession session = managed.getSession();
        if (session != null) {
            session.close(false);
        }
        managed.setState(ConnectionState.DISCONNECTED);
        managed.setConnectedSince(null);
        log.info("Disconnected environment {}", environmentId);
    }

    public ManagedConnection reconnect(Environment environment) {
        disconnect(environment.getId());
        return connect(environment);
    }

    public ManagedConnection getStatus(String environmentId) {
        return connections.computeIfAbsent(environmentId, ManagedConnection::new);
    }

    /** Returns the live SSH session for an environment, throwing if it isn't connected. */
    public ClientSession getActiveSession(String environmentId) {
        ManagedConnection managed = connections.get(environmentId);
        if (managed == null || !managed.isUsable()) {
            throw new SshOperationException("Environment " + environmentId + " is not connected");
        }
        return managed.getSession();
    }

    public boolean isConnected(String environmentId) {
        ManagedConnection managed = connections.get(environmentId);
        return managed != null && managed.isUsable();
    }

    /** Runs a trivial round trip on an already-open session to measure health/latency. */
    public long pingLatencyMs(String environmentId) {
        ClientSession session = getActiveSession(environmentId);
        long start = System.currentTimeMillis();
        try (ChannelExec channel = session.createExecChannel("echo batchpilot-ping")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            channel.setOut(out);
            channel.open().verify(5, TimeUnit.SECONDS);
            channel.waitFor(EnumSet.of(ClientChannelEvent.CLOSED), 5000);
            return System.currentTimeMillis() - start;
        } catch (Exception e) {
            throw new SshOperationException("Health check failed: " + e.getMessage(), e);
        }
    }

    public Set<String> connectedEnvironmentIds() {
        return connections.entrySet().stream()
                .filter(e -> e.getValue().isUsable())
                .map(Map.Entry::getKey)
                .collect(java.util.stream.Collectors.toSet());
    }

    @PreDestroy
    public void shutdown() {
        connections.values().forEach(managed -> {
            managed.setManualDisconnect(true);
            if (managed.getSession() != null) {
                managed.getSession().close(true);
            }
        });
        reconnectExecutor.shutdownNow();
    }
}

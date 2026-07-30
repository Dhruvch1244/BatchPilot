package com.batchpilot.ssh;

import com.batchpilot.model.ConnectionState;
import org.apache.sshd.client.session.ClientSession;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Tracks the live state of one environment's SSH session, independent of the
 * persisted {@link com.batchpilot.model.Environment} record.
 */
public class ManagedConnection {

    private final String environmentId;
    private volatile ClientSession session;
    private volatile ConnectionState state = ConnectionState.DISCONNECTED;
    private volatile Instant connectedSince;
    private volatile String lastError;
    private volatile boolean manualDisconnect = false;
    private final AtomicInteger reconnectAttempts = new AtomicInteger(0);

    public ManagedConnection(String environmentId) {
        this.environmentId = environmentId;
    }

    public String getEnvironmentId() {
        return environmentId;
    }

    public ClientSession getSession() {
        return session;
    }

    public void setSession(ClientSession session) {
        this.session = session;
    }

    public ConnectionState getState() {
        return state;
    }

    public void setState(ConnectionState state) {
        this.state = state;
    }

    public Instant getConnectedSince() {
        return connectedSince;
    }

    public void setConnectedSince(Instant connectedSince) {
        this.connectedSince = connectedSince;
    }

    public String getLastError() {
        return lastError;
    }

    public void setLastError(String lastError) {
        this.lastError = lastError;
    }

    public boolean isManualDisconnect() {
        return manualDisconnect;
    }

    public void setManualDisconnect(boolean manualDisconnect) {
        this.manualDisconnect = manualDisconnect;
    }

    public AtomicInteger getReconnectAttempts() {
        return reconnectAttempts;
    }

    public boolean isUsable() {
        return session != null && session.isOpen() && session.isAuthenticated();
    }
}

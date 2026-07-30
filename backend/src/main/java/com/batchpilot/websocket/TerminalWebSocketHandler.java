package com.batchpilot.websocket;

import com.batchpilot.ssh.SshConnectionManager;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.sshd.client.channel.ChannelShell;
import org.apache.sshd.client.session.ClientSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Bridges one xterm.js tab (one WebSocket connection) to one interactive PTY shell
 * channel on an already-connected environment. Binary frames are raw terminal
 * bytes in both directions; text frames carry small JSON control messages
 * (currently just PTY resize).
 */
@Component
public class TerminalWebSocketHandler extends AbstractWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(TerminalWebSocketHandler.class);

    private final SshConnectionManager connectionManager;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, TerminalSession> sessions = new ConcurrentHashMap<>();

    public TerminalWebSocketHandler(SshConnectionManager connectionManager) {
        this.connectionManager = connectionManager;
    }

    private record TerminalSession(ChannelShell channel, Thread pump) {
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession wsSession) throws Exception {
        String environmentId = extractEnvironmentId(wsSession);
        Map<String, String> query = parseQuery(wsSession);
        int cols = parseIntOr(query.get("cols"), 80);
        int rows = parseIntOr(query.get("rows"), 24);

        try {
            ClientSession sshSession = connectionManager.getActiveSession(environmentId);
            ChannelShell channel = sshSession.createShellChannel();
            channel.setPtyType("xterm-256color");
            channel.setPtyColumns(cols);
            channel.setPtyLines(rows);
            channel.setUsePty(true);
            channel.setAgentForwarding(false);
            channel.open().verify(10, TimeUnit.SECONDS);

            InputStream remoteOut = channel.getInvertedOut();
            Thread pump = new Thread(() -> pumpOutput(wsSession, remoteOut), "terminal-pump-" + wsSession.getId());
            pump.setDaemon(true);

            sessions.put(wsSession.getId(), new TerminalSession(channel, pump));
            pump.start();

            sendControl(wsSession, "status", "connected");
            log.info("Terminal opened for environment {} ({}x{})", environmentId, cols, rows);
        } catch (Exception e) {
            log.warn("Failed to open terminal for environment {}: {}", environmentId, e.getMessage());
            sendControl(wsSession, "error", "Unable to open terminal: " + e.getMessage());
            wsSession.close(CloseStatus.SERVER_ERROR);
        }
    }

    private void pumpOutput(WebSocketSession wsSession, InputStream remoteOut) {
        byte[] buffer = new byte[8192];
        try {
            int n;
            while (wsSession.isOpen() && (n = remoteOut.read(buffer)) != -1) {
                byte[] chunk = new byte[n];
                System.arraycopy(buffer, 0, chunk, 0, n);
                synchronized (wsSession) {
                    if (wsSession.isOpen()) {
                        wsSession.sendMessage(new BinaryMessage(chunk));
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Terminal output stream ended for session {}: {}", wsSession.getId(), e.getMessage());
        } finally {
            closeQuietly(wsSession);
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession wsSession, BinaryMessage message) throws Exception {
        TerminalSession terminal = sessions.get(wsSession.getId());
        if (terminal == null) {
            return;
        }
        OutputStream stdin = terminal.channel().getInvertedIn();
        // Must respect the buffer's actual position/limit rather than assuming the
        // backing array (.array()) starts at 0 and is exactly the payload length --
        // the servlet container's ByteBuffer isn't guaranteed to be shaped that way.
        ByteBuffer payload = message.getPayload();
        byte[] data = new byte[payload.remaining()];
        payload.get(data);
        stdin.write(data);
        stdin.flush();
    }

    @Override
    protected void handleTextMessage(WebSocketSession wsSession, TextMessage message) throws Exception {
        TerminalSession terminal = sessions.get(wsSession.getId());
        if (terminal == null) {
            return;
        }
        JsonNode node = mapper.readTree(message.getPayload());
        String type = node.path("type").asText("");
        if ("resize".equals(type)) {
            int cols = node.path("cols").asInt(80);
            int rows = node.path("rows").asInt(24);
            terminal.channel().sendWindowChange(cols, rows);
        } else if ("input".equals(type)) {
            String data = node.path("data").asText("");
            OutputStream stdin = terminal.channel().getInvertedIn();
            stdin.write(data.getBytes(StandardCharsets.UTF_8));
            stdin.flush();
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession wsSession, CloseStatus status) {
        TerminalSession terminal = sessions.remove(wsSession.getId());
        if (terminal != null) {
            terminal.channel().close(true);
        }
    }

    private void closeQuietly(WebSocketSession wsSession) {
        try {
            if (wsSession.isOpen()) {
                wsSession.close();
            }
        } catch (Exception ignored) {
            // already closing
        }
    }

    private void sendControl(WebSocketSession wsSession, String type, String value) {
        try {
            synchronized (wsSession) {
                wsSession.sendMessage(new TextMessage(
                        mapper.writeValueAsString(Map.of("type", type, "message", value))));
            }
        } catch (Exception e) {
            log.debug("Failed to send control message: {}", e.getMessage());
        }
    }

    private String extractEnvironmentId(WebSocketSession wsSession) {
        String path = wsSession.getUri() != null ? wsSession.getUri().getPath() : "";
        String marker = "/ws/terminal/";
        int idx = path.indexOf(marker);
        return idx >= 0 ? path.substring(idx + marker.length()) : "";
    }

    private Map<String, String> parseQuery(WebSocketSession wsSession) {
        if (wsSession.getUri() == null || wsSession.getUri().getQuery() == null) {
            return Map.of();
        }
        return UriComponentsBuilder.fromUri(wsSession.getUri()).build().getQueryParams()
                .toSingleValueMap();
    }

    private int parseIntOr(String value, int fallback) {
        try {
            return value != null ? Integer.parseInt(value) : fallback;
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}

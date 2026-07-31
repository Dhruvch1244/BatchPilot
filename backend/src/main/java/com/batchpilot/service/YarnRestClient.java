package com.batchpilot.service;

import com.batchpilot.model.YarnApplication;
import com.batchpilot.model.YarnNode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Talks directly to the YARN ResourceManager's own REST API - the same JSON the RM web UI's
 * "All Applications" table (`/cluster/apps`) loads asynchronously from `/ws/v1/cluster/apps` -
 * instead of shelling out to the `yarn` CLI over SSH. Much faster when reachable: no SSH
 * round-trip, no JVM cold-start for the CLI, no text parsing. The RM webapp port isn't always
 * reachable from wherever BatchPilot runs though, so every call here is expected to fail fast
 * (short timeouts) and let {@link YarnService} fall back to SSH.
 *
 * @see <a href="https://hadoop.apache.org/docs/stable/hadoop-yarn/hadoop-yarn-site/ResourceManagerRest.html">
 *      Hadoop YARN ResourceManager REST API</a>
 */
@Component
class YarnRestClient {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    private final ObjectMapper objectMapper;

    YarnRestClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    List<YarnApplication> listApplications(String rmBaseUrl) {
        JsonNode root = get(rmBaseUrl + "/ws/v1/cluster/apps");
        List<YarnApplication> apps = new ArrayList<>();
        for (JsonNode a : root.path("apps").path("app")) {
            apps.add(toApplication(a));
        }
        return apps;
    }

    YarnApplication getApplication(String rmBaseUrl, String applicationId) {
        JsonNode root = get(rmBaseUrl + "/ws/v1/cluster/apps/" + applicationId);
        JsonNode a = root.path("app");
        if (a.isMissingNode() || a.isNull()) {
            throw new YarnRestUnavailableException("Empty RM response for application " + applicationId);
        }
        return toApplication(a);
    }

    /** PUTs the RM's documented desired-state transition; a 2xx response (200 if applied
     * synchronously, 202 if accepted and still transitioning) both count as success. */
    void killApplication(String rmBaseUrl, String applicationId) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(rmBaseUrl + "/ws/v1/cluster/apps/" + applicationId + "/state"))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString("{\"state\":\"KILLED\"}"))
                .build();
        send(request);
    }

    List<YarnNode> listNodes(String rmBaseUrl) {
        JsonNode root = get(rmBaseUrl + "/ws/v1/cluster/nodes");
        List<YarnNode> nodes = new ArrayList<>();
        for (JsonNode n : root.path("nodes").path("node")) {
            nodes.add(YarnNode.builder()
                    .nodeId(textOrNull(n, "id"))
                    .nodeState(textOrNull(n, "state"))
                    .nodeHttpAddress(textOrNull(n, "nodeHTTPAddress"))
                    .runningContainers(n.hasNonNull("numContainers") ? n.get("numContainers").asInt() : null)
                    .build());
        }
        return nodes;
    }

    private YarnApplication toApplication(JsonNode a) {
        return YarnApplication.builder()
                .applicationId(textOrNull(a, "id"))
                .applicationName(textOrNull(a, "name"))
                .applicationType(textOrNull(a, "applicationType"))
                .user(textOrNull(a, "user"))
                .queue(textOrNull(a, "queue"))
                .state(textOrNull(a, "state"))
                .finalStatus(textOrNull(a, "finalStatus"))
                .progressPercent(a.hasNonNull("progress") ? Math.round(a.get("progress").floatValue()) : null)
                .trackingUrl(textOrNull(a, "trackingUrl"))
                .startTime(positiveOrNull(a, "startedTime"))
                .finishTime(positiveOrNull(a, "finishedTime"))
                .build();
    }

    private String textOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return (v == null || v.isNull()) ? null : v.asText();
    }

    private Long positiveOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) {
            return null;
        }
        long value = v.asLong();
        return value > 0 ? value : null;
    }

    private JsonNode get(String url) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/json")
                .GET()
                .build();
        return send(request);
    }

    private JsonNode send(HttpRequest request) {
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new YarnRestUnavailableException(
                        "RM REST call to " + request.uri() + " returned HTTP " + response.statusCode());
            }
            String body = response.body();
            if (body == null || body.isBlank()) {
                return objectMapper.createObjectNode();
            }
            return objectMapper.readTree(body);
        } catch (IOException e) {
            throw new YarnRestUnavailableException("RM REST call to " + request.uri() + " failed: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new YarnRestUnavailableException("RM REST call to " + request.uri() + " interrupted", e);
        }
    }
}

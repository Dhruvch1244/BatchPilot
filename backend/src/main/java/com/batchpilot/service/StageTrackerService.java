package com.batchpilot.service;

import com.batchpilot.dto.StageGroup;
import com.batchpilot.dto.StageMatch;
import com.batchpilot.dto.StageSearchResult;
import com.batchpilot.model.Environment;
import com.batchpilot.model.PipelineStage;
import com.batchpilot.model.StageSearchHistoryEntry;
import com.batchpilot.model.YarnApplication;
import com.batchpilot.repository.StageSearchHistoryRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Finds which running/recent YARN applications correspond to a given filename and
 * classifies each into one of the five pipeline stages.
 *
 * <p><strong>This is a v1 heuristic, not ground truth.</strong> There is no wired-up
 * connection to the pipeline's own status database ("Daaf DB") that would give an
 * authoritative per-file stage; instead, stage membership is inferred from keywords
 * in the YARN application's name (e.g. an application named
 * {@code Preprocessor_<file>_20260730} is classified as PREPROCESSOR). Multiple YARN
 * applications can match the same file — e.g. re-runs of the same stage, or one
 * application per pipeline stage — so every match is kept and shown, not collapsed
 * into a single result.
 */
@Service
public class StageTrackerService {

    private final YarnService yarnService;
    private final EnvironmentService environmentService;
    private final StageSearchHistoryRepository historyRepository;

    public StageTrackerService(YarnService yarnService,
                                EnvironmentService environmentService,
                                StageSearchHistoryRepository historyRepository) {
        this.yarnService = yarnService;
        this.environmentService = environmentService;
        this.historyRepository = historyRepository;
    }

    public StageSearchResult search(String environmentId, String filename) {
        Environment environment = environmentService.findById(environmentId);
        String needle = filename.strip().toLowerCase(Locale.ROOT);

        List<YarnApplication> candidates = yarnService.listApplications(environmentId).stream()
                .filter(app -> app.getApplicationName() != null
                        && app.getApplicationName().toLowerCase(Locale.ROOT).contains(needle))
                .toList();

        Map<PipelineStage, List<StageMatch>> byStage = new EnumMap<>(PipelineStage.class);
        for (PipelineStage stage : PipelineStage.values()) {
            byStage.put(stage, new ArrayList<>());
        }
        List<StageMatch> unclassified = new ArrayList<>();

        for (YarnApplication candidate : candidates) {
            StageMatch match = toMatch(environmentId, candidate);
            PipelineStage stage = PipelineStage.matchApplicationName(candidate.getApplicationName());
            if (stage != null) {
                byStage.get(stage).add(match);
            } else {
                unclassified.add(match);
            }
        }

        List<StageGroup> groups = new ArrayList<>();
        Map<String, Integer> stageCounts = new LinkedHashMap<>();
        for (PipelineStage stage : PipelineStage.values()) {
            List<StageMatch> matches = byStage.get(stage);
            matches.sort(Comparator.comparing((StageMatch m) -> m.getStartTime() == null ? 0L : m.getStartTime()).reversed());
            groups.add(StageGroup.builder().stage(stage.name()).label(stage.getLabel()).matches(matches).build());
            stageCounts.put(stage.name(), matches.size());
        }
        unclassified.sort(Comparator.comparing((StageMatch m) -> m.getStartTime() == null ? 0L : m.getStartTime()).reversed());

        long searchedAt = Instant.now().toEpochMilli();

        historyRepository.add(new StageSearchHistoryEntry(
                UUID.randomUUID().toString(), environmentId, environment.getName(),
                filename.strip(), searchedAt, candidates.size(), stageCounts));

        return StageSearchResult.builder()
                .environmentId(environmentId)
                .filename(filename.strip())
                .searchedAt(searchedAt)
                .stages(groups)
                .unclassifiedMatches(unclassified)
                .build();
    }

    public List<StageSearchHistoryEntry> history() {
        return historyRepository.findAll();
    }

    public void clearHistory() {
        historyRepository.clear();
    }

    /**
     * `-list` doesn't carry Start-Time/Finish-Time, so re-fetch per-application detail via
     * `-status` for accurate timing; best-effort — falls back to the list-level snapshot
     * (no times, so elapsed is reported as 0) if the detail call fails for any one match.
     */
    private StageMatch toMatch(String environmentId, YarnApplication candidate) {
        YarnApplication detail;
        try {
            detail = yarnService.getStatus(environmentId, candidate.getApplicationId());
        } catch (Exception e) {
            detail = candidate;
        }
        long now = System.currentTimeMillis();
        Long start = detail.getStartTime();
        Long finish = detail.getFinishTime();
        long elapsed = 0;
        if (start != null) {
            elapsed = (finish != null ? finish : now) - start;
        }
        return StageMatch.builder()
                .applicationId(detail.getApplicationId())
                .applicationName(detail.getApplicationName())
                .state(detail.getState())
                .finalStatus(detail.getFinalStatus())
                .progressPercent(detail.getProgressPercent())
                .trackingUrl(detail.getTrackingUrl())
                .startTime(start)
                .finishTime(finish)
                .elapsedMs(Math.max(elapsed, 0))
                .build();
    }
}

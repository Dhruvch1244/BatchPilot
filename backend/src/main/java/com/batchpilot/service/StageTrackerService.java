package com.batchpilot.service;

import com.batchpilot.dto.FileStageResult;
import com.batchpilot.dto.StageGroup;
import com.batchpilot.dto.StageMatch;
import com.batchpilot.dto.StageSearchResult;
import com.batchpilot.model.Environment;
import com.batchpilot.model.PipelineStage;
import com.batchpilot.model.StageSearchHistoryEntry;
import com.batchpilot.model.YarnApplication;
import com.batchpilot.repository.StageSearchHistoryRepository;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Finds which running/recent YARN applications correspond to a search term and
 * classifies each into a pipeline stage, grouped by the distinct file each belongs to.
 *
 * <p><strong>This is a v1 heuristic, not ground truth.</strong> There is no wired-up
 * connection to the pipeline's own status database that would give an authoritative
 * per-file stage; instead, both the file identity and the stage are inferred from the
 * YARN application's name via {@link PipelineStage#extract}, following the
 * {@code <Stage>_<fileName>_<YYYYMMDD>} naming convention. A broad search term can
 * match applications belonging to several different files (e.g. searching "report"
 * might hit both "monthly_report" and "report_2026"), so results are grouped by the
 * extracted file name — one {@link FileStageResult} per distinct file, not one
 * flat list.
 */
@Service
public class StageTrackerService {

    private final YarnService yarnService;
    private final EnvironmentService environmentService;
    private final StageSearchHistoryRepository historyRepository;

    /** Per-match `-status` calls run concurrently over the same SSH session (which SSH's
     * own multiplexing supports natively) instead of sequentially — with a dozen+ matches,
     * sequential round-trips were the dominant cost of a search. */
    private final ExecutorService statusFetchPool = Executors.newFixedThreadPool(8, r -> {
        Thread t = new Thread(r, "stage-tracker-status-fetch");
        t.setDaemon(true);
        return t;
    });

    public StageTrackerService(YarnService yarnService,
                                EnvironmentService environmentService,
                                StageSearchHistoryRepository historyRepository) {
        this.yarnService = yarnService;
        this.environmentService = environmentService;
        this.historyRepository = historyRepository;
    }

    @PreDestroy
    public void shutdown() {
        statusFetchPool.shutdownNow();
    }

    public StageSearchResult search(String environmentId, String query) {
        Environment environment = environmentService.findById(environmentId);
        String needle = query.strip().toLowerCase(Locale.ROOT);

        List<YarnApplication> candidates = yarnService.listApplications(environmentId).stream()
                .filter(app -> app.getApplicationName() != null
                        && app.getApplicationName().toLowerCase(Locale.ROOT).contains(needle))
                .toList();

        List<StageMatchWithExtraction> matches = fetchMatchesConcurrently(environmentId, candidates);

        Map<String, List<StageMatchWithExtraction>> byFile = new LinkedHashMap<>();
        for (StageMatchWithExtraction m : matches) {
            byFile.computeIfAbsent(m.extraction.coreFileName(), k -> new ArrayList<>()).add(m);
        }

        List<FileStageResult> files = new ArrayList<>();
        Map<String, Integer> fileCounts = new LinkedHashMap<>();
        Map<String, Long> lastActivityByFile = new LinkedHashMap<>();
        for (Map.Entry<String, List<StageMatchWithExtraction>> entry : byFile.entrySet()) {
            files.add(buildFileResult(entry.getKey(), entry.getValue()));
            fileCounts.put(entry.getKey(), entry.getValue().size());
            lastActivityByFile.put(entry.getKey(), lastActivity(entry.getValue()));
        }
        // Most recently active file first — a still-RUNNING file (no finish time yet) is
        // just as "recent" as one that just finished, so this uses whichever of
        // start/finish is latest per match, not only completed ones.
        files.sort(Comparator.comparing((FileStageResult f) -> lastActivityByFile.get(f.getCoreFileName()))
                .reversed()
                .thenComparing(FileStageResult::getCoreFileName));

        long searchedAt = Instant.now().toEpochMilli();
        historyRepository.add(new StageSearchHistoryEntry(
                UUID.randomUUID().toString(), environmentId, environment.getName(),
                query.strip(), searchedAt, candidates.size(), fileCounts));

        return StageSearchResult.builder()
                .environmentId(environmentId)
                .query(query.strip())
                .searchedAt(searchedAt)
                .files(files)
                .build();
    }

    public List<StageSearchHistoryEntry> history(int limit) {
        List<StageSearchHistoryEntry> all = historyRepository.findAll();
        return all.subList(0, Math.min(limit, all.size()));
    }

    public void clearHistory() {
        historyRepository.clear();
    }

    private FileStageResult buildFileResult(String coreFileName, List<StageMatchWithExtraction> fileMatches) {
        Map<PipelineStage, List<StageMatch>> byStage = new LinkedHashMap<>();
        List<StageMatch> unclassified = new ArrayList<>();
        Long latestCompleted = null;

        for (StageMatchWithExtraction m : fileMatches) {
            if (m.extraction.stage() != null) {
                byStage.computeIfAbsent(m.extraction.stage(), k -> new ArrayList<>()).add(m.match);
            } else {
                unclassified.add(m.match);
            }
            if (m.match.getFinishTime() != null && (latestCompleted == null || m.match.getFinishTime() > latestCompleted)) {
                latestCompleted = m.match.getFinishTime();
            }
        }

        // Only stages actually present. The five core stages (Preprocessor, Validation,
        // Normalization, Delta, Transmission) always occur in that relative order when
        // present - that ordering is fixed, not inferred from timing, since timing can
        // be noisy (clock skew, retries). Any other recognized stage (Outbound, or a
        // future addition) has no fixed position, so it's interleaved among the core
        // stages by its earliest observed start time instead - "the flow" for whatever
        // extra step this particular file happens to have.
        List<Map.Entry<PipelineStage, List<StageMatch>>> entries = new ArrayList<>(byStage.entrySet());
        List<Map.Entry<PipelineStage, List<StageMatch>>> core = entries.stream()
                .filter(e -> PipelineStage.CORE_ORDER.contains(e.getKey()))
                .sorted(Comparator.comparingInt(e -> PipelineStage.CORE_ORDER.indexOf(e.getKey())))
                .toList();
        List<Map.Entry<PipelineStage, List<StageMatch>>> extras = entries.stream()
                .filter(e -> !PipelineStage.CORE_ORDER.contains(e.getKey()))
                .sorted(Comparator.comparingLong(e -> earliestStart(e.getValue())))
                .toList();

        List<Map.Entry<PipelineStage, List<StageMatch>>> ordered = new ArrayList<>();
        int coreIndex = 0;
        for (Map.Entry<PipelineStage, List<StageMatch>> extra : extras) {
            long extraStart = earliestStart(extra.getValue());
            while (coreIndex < core.size() && earliestStart(core.get(coreIndex).getValue()) <= extraStart) {
                ordered.add(core.get(coreIndex));
                coreIndex++;
            }
            ordered.add(extra);
        }
        while (coreIndex < core.size()) {
            ordered.add(core.get(coreIndex));
            coreIndex++;
        }

        List<StageGroup> groups = ordered.stream()
                .map(e -> {
                    List<StageMatch> sorted = new ArrayList<>(e.getValue());
                    sorted.sort(Comparator.comparing((StageMatch sm) -> sm.getStartTime() == null ? 0L : sm.getStartTime()).reversed());
                    return StageGroup.builder().stage(e.getKey().name()).label(e.getKey().getLabel()).matches(sorted).build();
                })
                .toList();

        unclassified.sort(Comparator.comparing((StageMatch m) -> m.getStartTime() == null ? 0L : m.getStartTime()).reversed());

        return FileStageResult.builder()
                .coreFileName(coreFileName)
                .latestCompletedAt(latestCompleted)
                .stages(groups)
                .unclassifiedMatches(unclassified)
                .build();
    }

    private long earliestStart(List<StageMatch> matches) {
        return matches.stream().mapToLong(m -> m.getStartTime() == null ? Long.MAX_VALUE : m.getStartTime()).min().orElse(Long.MAX_VALUE);
    }

    private long lastActivity(List<StageMatchWithExtraction> matches) {
        return matches.stream()
                .mapToLong(m -> {
                    Long finish = m.match.getFinishTime();
                    Long start = m.match.getStartTime();
                    if (finish != null) return finish;
                    if (start != null) return start;
                    return 0L;
                })
                .max().orElse(0L);
    }

    private List<StageMatchWithExtraction> fetchMatchesConcurrently(String environmentId, List<YarnApplication> candidates) {
        List<CompletableFuture<StageMatchWithExtraction>> futures = candidates.stream()
                .map(candidate -> CompletableFuture.supplyAsync(() -> toMatch(environmentId, candidate), statusFetchPool))
                .toList();
        return futures.stream().map(CompletableFuture::join).toList();
    }

    /**
     * `-list` doesn't carry Start-Time/Finish-Time, so re-fetch per-application detail via
     * `-status` for accurate timing; best-effort — falls back to the list-level snapshot
     * (no times, so elapsed is reported as 0) if the detail call fails for any one match.
     */
    private StageMatchWithExtraction toMatch(String environmentId, YarnApplication candidate) {
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
        PipelineStage.Extraction extraction = PipelineStage.extract(detail.getApplicationName());
        StageMatch match = StageMatch.builder()
                .applicationId(detail.getApplicationId())
                .applicationName(detail.getApplicationName())
                .state(detail.getState())
                .finalStatus(detail.getFinalStatus())
                .progressPercent(detail.getProgressPercent())
                .trackingUrl(detail.getTrackingUrl())
                .startTime(start)
                .finishTime(finish)
                .elapsedMs(Math.max(elapsed, 0))
                .runTimestamp(extraction.runTimestamp())
                .build();
        return new StageMatchWithExtraction(match, extraction);
    }

    private record StageMatchWithExtraction(StageMatch match, PipelineStage.Extraction extraction) {
    }
}

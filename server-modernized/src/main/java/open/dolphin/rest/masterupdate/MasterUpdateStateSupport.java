package open.dolphin.rest.masterupdate;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

final class MasterUpdateStateSupport {

    static final int MAX_VERSIONS_PER_DATASET = 20;

    private MasterUpdateStateSupport() {
    }

    static MasterUpdateStore.DatasetState requireDataset(MasterUpdateStore.Snapshot snapshot, String datasetCode) {
        String normalized = normalizeDatasetCode(datasetCode);
        MasterUpdateStore.DatasetState state = MasterUpdateStore.findDataset(snapshot, normalized);
        if (state == null) {
            throw new MasterUpdateService.MasterUpdateException(404, "dataset_not_found", "指定されたデータセットが見つかりません: " + datasetCode);
        }
        return state;
    }

    static String normalizeDatasetCode(String datasetCode) {
        if (datasetCode == null) {
            return null;
        }
        String normalized = datasetCode.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    static String normalizeTriggerType(String triggerType) {
        return triggerType == null || triggerType.isBlank() ? "MANUAL" : triggerType.trim();
    }

    static String normalizeRequestedBy(String requestedBy) {
        return requestedBy == null || requestedBy.isBlank() ? "unknown" : requestedBy.trim();
    }

    static boolean isRunning(MasterUpdateStore.DatasetState state) {
        return state != null
                && state.lockJobId != null
                && !state.lockJobId.isBlank();
    }

    static void markRunStarted(MasterUpdateStore store,
                               String datasetCode,
                               String jobId,
                               String runId,
                               String now) {
        store.update(snapshot -> {
            MasterUpdateStore.DatasetState state = requireDataset(snapshot, datasetCode);
            if (isRunning(state)) {
                throw new MasterUpdateService.MasterUpdateException(409, "dataset_running", "更新処理は既に実行中です。");
            }
            state.lockJobId = jobId;
            state.status = "running";
            state.latestRunId = runId;
            state.latestJobMessage = "更新処理を開始しました";
            return null;
        });
    }

    static MasterUpdateStore.DatasetState applyRunSuccess(MasterUpdateStore store,
                                                          String datasetCode,
                                                          MasterUpdateArtifacts.UpdateArtifact artifact,
                                                          String artifactPath,
                                                          String runId,
                                                          String triggerType,
                                                          String requestedBy,
                                                          String now,
                                                          boolean force) {
        return store.update(snapshot -> {
            MasterUpdateStore.DatasetState state = requireDataset(snapshot, datasetCode);
            MasterUpdateStore.DatasetVersion previous = state.currentVersion();

            state.lastCheckedAt = now;
            state.latestRunId = runId;
            state.lastFailureAt = null;
            state.lastFailureReason = null;
            state.lockJobId = null;
            if ("AUTO".equalsIgnoreCase(triggerType) || "AUTO_POLL".equalsIgnoreCase(triggerType)) {
                state.lastAutoRunAt = now;
                state.lastPolledAt = now;
            }

            boolean noChange = !force
                    && previous != null
                    && previous.hash != null
                    && previous.hash.equals(artifact.hash);

            if (noChange) {
                state.status = "normal";
                state.latestJobMessage = "差分なし（現行版を維持）";
                state.lastSuccessfulAt = now;
                state.updateDetected = false;
                return state;
            }

            MasterUpdateStore.DatasetVersion version = newVersion(previous, artifact, artifactPath, runId, triggerType, requestedBy, now);
            updateCurrentVersion(state, version);
            state.status = "normal";
            state.lastSuccessfulAt = now;
            state.latestJobMessage = "更新版を反映しました";
            state.updateDetected = false;
            return state;
        });
    }

    static MasterUpdateStore.DatasetState applyUpload(MasterUpdateStore store,
                                                      String datasetCode,
                                                      String fileName,
                                                      String hash,
                                                      long recordCount,
                                                      String artifactPath,
                                                      String requestedBy,
                                                      String runId,
                                                      String now) {
        return store.update(snapshot -> {
            MasterUpdateStore.DatasetState state = requireDataset(snapshot, datasetCode);
            MasterUpdateStore.DatasetVersion previous = state.currentVersion();
            MasterUpdateStore.DatasetVersion version = new MasterUpdateStore.DatasetVersion();
            version.versionId = buildVersionId();
            version.capturedAt = now;
            version.status = "READY";
            version.hash = hash;
            version.recordCount = Math.max(0L, recordCount);
            version.artifactPath = artifactPath;
            version.sourceUrl = state.sourceUrl;
            version.summary = "manual upload";
            version.triggerType = "UPLOAD";
            version.requestedBy = requestedBy;
            version.runId = runId;
            long previousCount = previous != null ? Math.max(0L, previous.recordCount) : 0L;
            long currentCount = Math.max(0L, recordCount);
            version.addedCount = Math.max(0L, currentCount - previousCount);
            version.removedCount = Math.max(0L, previousCount - currentCount);
            version.changedCount = previousCount == currentCount ? 0L : Math.min(previousCount, currentCount) / 10L;
            version.note = fileName;
            version.current = true;

            updateCurrentVersion(state, version);
            state.status = "normal";
            state.lastCheckedAt = now;
            state.lastSuccessfulAt = now;
            state.lastFailureAt = null;
            state.lastFailureReason = null;
            state.latestRunId = runId;
            state.latestJobMessage = "アップロード版を反映しました";
            state.updateDetected = false;
            return state;
        });
    }

    static MasterUpdateStore.DatasetState applyRollback(MasterUpdateStore store,
                                                        String datasetCode,
                                                        String versionId,
                                                        String runId,
                                                        String now) {
        return store.update(snapshot -> {
            MasterUpdateStore.DatasetState state = requireDataset(snapshot, datasetCode);
            if (isRunning(state)) {
                throw new MasterUpdateService.MasterUpdateException(409, "dataset_running", "実行中のためロールバックできません。");
            }
            MasterUpdateStore.DatasetVersion target = null;
            for (MasterUpdateStore.DatasetVersion version : state.versions) {
                if (Objects.equals(versionId, version.versionId)) {
                    target = version;
                    break;
                }
            }
            if (target == null) {
                throw new MasterUpdateService.MasterUpdateException(404, "version_not_found", "指定された versionId が見つかりません。");
            }

            for (MasterUpdateStore.DatasetVersion version : state.versions) {
                version.current = false;
            }
            target.current = true;
            state.currentVersionId = target.versionId;
            state.currentRecordCount = target.recordCount;
            state.status = "normal";
            state.lastCheckedAt = now;
            state.lastSuccessfulAt = now;
            state.latestRunId = runId;
            state.latestJobMessage = "ロールバックを実行しました";
            state.updateDetected = false;
            return state;
        });
    }

    static MasterUpdateStore.ScheduleConfig updateSchedule(MasterUpdateStore store, Map<String, Object> payload) {
        return store.update(snapshot -> {
            MasterUpdateStore.ScheduleConfig schedule = snapshot.schedule != null
                    ? snapshot.schedule
                    : MasterUpdateStore.ScheduleConfig.defaults();

            if (payload != null) {
                String autoUpdateTime = MasterUpdatePayloads.asString(payload.get("autoUpdateTime"));
                Integer retryCount = MasterUpdatePayloads.asInteger(payload.get("retryCount"));
                Integer timeoutSeconds = MasterUpdatePayloads.asInteger(payload.get("timeoutSeconds"));
                Integer maxConcurrency = MasterUpdatePayloads.asInteger(payload.get("maxConcurrency"));
                Integer pollMinutes = MasterUpdatePayloads.asInteger(payload.get("orcaPollIntervalMinutes"));
                @SuppressWarnings("unchecked")
                Map<String, Object> overrides = payload.get("datasetAutoEnabledOverrides") instanceof Map<?, ?> m
                        ? (Map<String, Object>) m
                        : null;

                if (autoUpdateTime != null && !autoUpdateTime.isBlank()) {
                    schedule.autoUpdateTime = autoUpdateTime;
                }
                if (retryCount != null) {
                    schedule.retryCount = Math.max(0, retryCount);
                }
                if (timeoutSeconds != null) {
                    schedule.timeoutSeconds = Math.max(10, timeoutSeconds);
                }
                if (maxConcurrency != null) {
                    schedule.maxConcurrency = Math.max(1, maxConcurrency);
                }
                if (pollMinutes != null) {
                    schedule.orcaPollIntervalMinutes = Math.max(1, pollMinutes);
                }
                if (overrides != null) {
                    schedule.datasetAutoEnabledOverrides = new LinkedHashMap<>();
                    for (Map.Entry<String, Object> entry : overrides.entrySet()) {
                        String code = normalizeDatasetCode(entry.getKey());
                        if (code != null) {
                            Optional<Boolean> parsed = MasterUpdatePayloads.asBoolean(entry.getValue());
                            parsed.ifPresent(value -> schedule.datasetAutoEnabledOverrides.put(code, value));
                        }
                    }
                }
            }

            snapshot.schedule = MasterUpdateStore.ScheduleConfig.applyDefaults(schedule);
            return snapshot.schedule;
        });
    }

    static List<String> resolveDueDatasets(MasterUpdateStore.Snapshot snapshot) {
        Instant now = Instant.now();
        MasterUpdateStore.ScheduleConfig schedule = snapshot.schedule != null
                ? snapshot.schedule
                : MasterUpdateStore.ScheduleConfig.defaults();

        List<String> due = new ArrayList<>();
        for (MasterUpdateStore.DatasetState state : snapshot.datasets.values()) {
            if (!state.active) {
                continue;
            }
            Boolean override = schedule.datasetAutoEnabledOverrides.get(state.code);
            boolean autoEnabled = override != null ? override : state.autoEnabled;
            if (!autoEnabled || isRunning(state)) {
                continue;
            }

            int intervalMinutes = state.defaultIntervalMinutes > 0 ? state.defaultIntervalMinutes : 1440;
            if ("orca_master_core".equals(state.code)) {
                intervalMinutes = Math.max(1, schedule.orcaPollIntervalMinutes);
            }

            Instant lastChecked = MasterUpdatePayloads.parseInstant(state.lastCheckedAt);
            if (lastChecked == null) {
                due.add(state.code);
                continue;
            }
            long elapsedMinutes = Duration.between(lastChecked, now).toMinutes();
            if (elapsedMinutes >= intervalMinutes) {
                due.add(state.code);
            }
        }
        return due;
    }

    static void failDatasetRun(MasterUpdateStore store,
                               String datasetCode,
                               String runId,
                               String now,
                               String message) {
        store.update(snapshot -> {
            MasterUpdateStore.DatasetState state = requireDataset(snapshot, datasetCode);
            state.status = "failed";
            state.lastCheckedAt = now;
            state.lastFailureAt = now;
            state.lastFailureReason = summarizeFailure(message);
            state.latestRunId = runId;
            state.latestJobMessage = "更新処理に失敗しました";
            state.lockJobId = null;
            return null;
        });
    }

    private static MasterUpdateStore.DatasetVersion newVersion(MasterUpdateStore.DatasetVersion previous,
                                                               MasterUpdateArtifacts.UpdateArtifact artifact,
                                                               String artifactPath,
                                                               String runId,
                                                               String triggerType,
                                                               String requestedBy,
                                                               String now) {
        long previousCount = previous != null ? Math.max(0L, previous.recordCount) : 0L;
        long currentCount = Math.max(0L, artifact.recordCount);

        MasterUpdateStore.DatasetVersion version = new MasterUpdateStore.DatasetVersion();
        version.versionId = buildVersionId();
        version.capturedAt = now;
        version.status = "READY";
        version.hash = artifact.hash;
        version.recordCount = currentCount;
        version.artifactPath = artifactPath;
        version.sourceUrl = artifact.sourceUrl;
        version.summary = artifact.summary;
        version.triggerType = triggerType;
        version.requestedBy = requestedBy;
        version.runId = runId;
        version.addedCount = Math.max(0L, currentCount - previousCount);
        version.removedCount = Math.max(0L, previousCount - currentCount);
        version.changedCount = previousCount == currentCount ? 0L : Math.min(previousCount, currentCount) / 10L;
        version.note = artifact.note;
        version.current = true;
        return version;
    }

    private static void updateCurrentVersion(MasterUpdateStore.DatasetState state,
                                             MasterUpdateStore.DatasetVersion version) {
        for (MasterUpdateStore.DatasetVersion existing : state.versions) {
            existing.current = false;
        }
        state.versions.add(0, version);
        while (state.versions.size() > MAX_VERSIONS_PER_DATASET) {
            state.versions.remove(state.versions.size() - 1);
        }
        state.currentVersionId = version.versionId;
        state.currentRecordCount = version.recordCount;
    }

    private static String summarizeFailure(String message) {
        if (message == null || message.isBlank()) {
            return "更新処理に失敗しました。";
        }
        if (message.length() <= 140) {
            return message;
        }
        return message.substring(0, 140) + "...";
    }

    private static String buildVersionId() {
        return LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
}

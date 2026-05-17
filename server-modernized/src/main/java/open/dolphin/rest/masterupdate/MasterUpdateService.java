package open.dolphin.rest.masterupdate;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.InputStream;
import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.orca.rest.LocalOrcaMasterCacheImportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Runtime service for dataset updates, versioning, and rollback.
 */
@ApplicationScoped
public class MasterUpdateService {

    private static final Logger LOGGER = LoggerFactory.getLogger(MasterUpdateService.class);

    @Inject
    private MasterUpdateStore store;

    @Inject
    private RestOrcaTransport restOrcaTransport;

    @Inject
    private ServerConfigurationResolver configurationResolver;

    @Inject
    private LocalOrcaMasterCacheImportService localMasterCacheImportService;

    private HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(20))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public Map<String, Object> listDatasets(String runId) {
        MasterUpdateStore.Snapshot snapshot = store.getSnapshot();
        List<Map<String, Object>> datasets = new ArrayList<>();
        snapshot.datasets.values().stream()
                .sorted(Comparator.comparing(state -> state.code == null ? "" : state.code))
                .forEach(state -> datasets.add(MasterUpdatePayloads.toSummary(state)));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("generatedAt", Instant.now().toString());
        body.put("datasets", datasets);
        body.put("schedule", MasterUpdatePayloads.toScheduleMap(snapshot.schedule));
        return body;
    }

    public Map<String, Object> getDatasetDetail(String datasetCode, String runId) {
        MasterUpdateStore.DatasetState state =
                MasterUpdateStateSupport.requireDataset(store.getSnapshot(), datasetCode);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("generatedAt", Instant.now().toString());
        body.put("dataset", MasterUpdatePayloads.toDetail(state));
        return body;
    }

    public Map<String, Object> runDataset(String datasetCode,
                                          String triggerType,
                                          String requestedBy,
                                          String runId,
                                          boolean force) {
        String normalizedCode = MasterUpdateStateSupport.normalizeDatasetCode(datasetCode);
        String normalizedTrigger = MasterUpdateStateSupport.normalizeTriggerType(triggerType);
        String actor = MasterUpdateStateSupport.normalizeRequestedBy(requestedBy);
        String now = Instant.now().toString();
        String jobId = UUID.randomUUID().toString();

        MasterUpdateStateSupport.markRunStarted(store, normalizedCode, jobId, runId, now);

        try {
            MasterUpdateArtifacts.UpdateArtifact artifact = artifacts().fetchDatasetArtifact(store, normalizedCode);
            String artifactPath = artifacts().writeArtifact(normalizedCode, artifact, runId, normalizedTrigger);
            LocalOrcaMasterCacheImportService.ImportResult importResult = importLocalMasterCacheIfSupported(
                    normalizedCode,
                    Path.of(artifactPath),
                    artifact.sourceUrl,
                    normalizedTrigger,
                    runId
            );
            if (importResult != null) {
                artifact.recordCount = importResult.importedRows();
                artifact.summary = appendImportSummary(artifact.summary, importResult);
                artifact.note = appendImportNote(artifact.note, importResult);
            }
            MasterUpdateStore.DatasetState updated = MasterUpdateStateSupport.applyRunSuccess(
                    store,
                    normalizedCode,
                    artifact,
                    artifactPath,
                    runId,
                    normalizedTrigger,
                    actor,
                    now,
                    force
            );

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("runId", runId);
            body.put("ok", true);
            body.put("message", "更新処理が完了しました。");
            body.put("dataset", MasterUpdatePayloads.toDetail(updated));
            body.put("triggerType", normalizedTrigger);
            body.put("artifactPath", artifactPath);
            if (importResult != null) {
                body.put("localMasterCacheImport", importResult.toMap());
            }
            return body;
        } catch (MasterUpdateException ex) {
            MasterUpdateStateSupport.failDatasetRun(store, normalizedCode, runId, now, ex.getMessage());
            throw ex;
        } catch (Exception ex) {
            LOGGER.warn("Dataset update failed. dataset={} runId={} err={}", normalizedCode, runId, ex.getMessage(), ex);
            MasterUpdateStateSupport.failDatasetRun(store, normalizedCode, runId, now, ex.getMessage());
            throw new MasterUpdateException(500, "dataset_update_failed", "更新処理に失敗しました: " + ex.getMessage());
        }
    }

    public Map<String, Object> uploadDataset(String datasetCode,
                                             String fileName,
                                             byte[] payload,
                                             String requestedBy,
                                             String runId) {
        String normalizedCode = MasterUpdateStateSupport.normalizeDatasetCode(datasetCode);
        if (payload == null || payload.length == 0) {
            throw new MasterUpdateException(400, "empty_upload", "アップロードファイルが空です。");
        }

        MasterUpdateStore.DatasetState dataset =
                MasterUpdateStateSupport.requireDataset(store.getSnapshot(), normalizedCode);
        if (!dataset.manualUploadAllowed) {
            throw new MasterUpdateException(400, "upload_not_allowed", "このデータセットは手動アップロードに対応していません。");
        }

        String extension = MasterUpdateArtifacts.resolveExtension(fileName, null);
        String hash = sha256(payload);
        String artifactPath = artifacts().writeArtifact(normalizedCode, extension, payload, runId, "UPLOAD");
        LocalOrcaMasterCacheImportService.ImportResult importResult = importLocalMasterCacheIfSupported(
                normalizedCode,
                Path.of(artifactPath),
                dataset.sourceUrl,
                "UPLOAD",
                runId
        );
        long recordCount = importResult != null
                ? importResult.importedRows()
                : estimateRecordCount(payload, extension, null);
        String now = Instant.now().toString();

        MasterUpdateStore.DatasetState updated = MasterUpdateStateSupport.applyUpload(
                store,
                normalizedCode,
                fileName,
                hash,
                recordCount,
                artifactPath,
                requestedBy,
                runId,
                now
        );

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("ok", true);
        body.put("message", "アップロード版を反映しました。");
        body.put("dataset", MasterUpdatePayloads.toDetail(updated));
        body.put("artifactPath", artifactPath);
        if (importResult != null) {
            body.put("localMasterCacheImport", importResult.toMap());
        }
        return body;
    }

    public Map<String, Object> rollbackDataset(String datasetCode,
                                               String versionId,
                                               String requestedBy,
                                               String runId) {
        String normalizedCode = MasterUpdateStateSupport.normalizeDatasetCode(datasetCode);
        if (versionId == null || versionId.isBlank()) {
            throw new MasterUpdateException(400, "version_required", "ロールバック対象の versionId が必要です。");
        }
        String now = Instant.now().toString();
        MasterUpdateStore.DatasetState updated =
                MasterUpdateStateSupport.applyRollback(store, normalizedCode, versionId, runId, now);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("ok", true);
        body.put("message", "ロールバックが完了しました。");
        body.put("requestedBy", requestedBy);
        body.put("dataset", MasterUpdatePayloads.toDetail(updated));
        return body;
    }

    public Map<String, Object> getSchedule(String runId) {
        MasterUpdateStore.Snapshot snapshot = store.getSnapshot();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("generatedAt", Instant.now().toString());
        body.put("schedule", MasterUpdatePayloads.toScheduleMap(snapshot.schedule));
        return body;
    }

    public Map<String, Object> updateSchedule(Map<String, Object> payload,
                                              String requestedBy,
                                              String runId) {
        MasterUpdateStore.ScheduleConfig updated = MasterUpdateStateSupport.updateSchedule(store, payload);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("ok", true);
        body.put("message", "スケジュールを更新しました。");
        body.put("updatedBy", requestedBy);
        body.put("schedule", MasterUpdatePayloads.toScheduleMap(updated));
        return body;
    }

    public Map<String, Object> getReferenceStatus(String runId) {
        MasterUpdateStore.Snapshot snapshot = store.getSnapshot();
        List<Map<String, Object>> datasets = new ArrayList<>();
        boolean hasFailure = false;
        boolean hasRunning = false;
        boolean hasUpdateDetected = false;

        for (MasterUpdateStore.DatasetState state : snapshot.datasets.values()) {
            Map<String, Object> row = MasterUpdatePayloads.toSummary(state);
            datasets.add(row);
            String status = MasterUpdatePayloads.asString(row.get("status"));
            if ("failed".equals(status)) {
                hasFailure = true;
            }
            if ("running".equals(status)) {
                hasRunning = true;
            }
            if (Boolean.TRUE.equals(row.get("updateDetected"))) {
                hasUpdateDetected = true;
            }
        }

        String overall;
        if (hasFailure) {
            overall = "failed";
        } else if (hasRunning) {
            overall = "running";
        } else if (hasUpdateDetected) {
            overall = "update_detected";
        } else {
            overall = "normal";
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("generatedAt", Instant.now().toString());
        body.put("overallStatus", overall);
        body.put("datasets", datasets);
        return body;
    }

    public void runAutoDatasetIfDue(String datasetCode) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue((String) null);
        try {
            runDataset(datasetCode, "AUTO", "system:scheduler", runId, false);
        } catch (MasterUpdateException ex) {
            if (ex.statusCode == 409) {
                LOGGER.debug("Skip auto run because dataset is already running. dataset={} runId={}", datasetCode, runId);
                return;
            }
            LOGGER.warn("Auto run failed. dataset={} runId={} err={}", datasetCode, runId, ex.getMessage());
        }
    }

    public List<String> resolveDueDatasets() {
        return MasterUpdateStateSupport.resolveDueDatasets(store.getSnapshot());
    }

    static long estimateRecordCount(byte[] payload, String extension, String contentType) {
        return MasterUpdateArtifacts.estimateRecordCount(payload, extension, contentType);
    }

    static long estimateRecordCount(Path artifactPath, String extension, String contentType) {
        return MasterUpdateArtifacts.estimateRecordCount(artifactPath, extension, contentType);
    }

    static StreamedArtifactData streamToFile(InputStream input, Path target) throws IOException {
        MasterUpdateArtifacts.StreamedArtifactData data = MasterUpdateArtifacts.streamToFile(input, target);
        return new StreamedArtifactData(data.size, data.hash);
    }

    private MasterUpdateArtifacts artifacts() {
        return new MasterUpdateArtifacts(restOrcaTransport, configurationResolver, httpClient);
    }

    private LocalOrcaMasterCacheImportService.ImportResult importLocalMasterCacheIfSupported(String datasetCode,
                                                                                            Path artifactPath,
                                                                                            String sourceUrl,
                                                                                            String triggerType,
                                                                                            String runId) {
        if (localMasterCacheImportService == null || !localMasterCacheImportService.supportsDataset(datasetCode)) {
            return null;
        }
        try {
            return localMasterCacheImportService.importArtifact(datasetCode, artifactPath, sourceUrl, triggerType, runId);
        } catch (MasterUpdateException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw new MasterUpdateException(500, "local_master_cache_import_failed",
                    "local master cache import に失敗しました。");
        }
    }

    private static String appendImportSummary(String summary, LocalOrcaMasterCacheImportService.ImportResult result) {
        String current = summary != null && !summary.isBlank() ? summary : "artifact fetched";
        return current + " / localMasterCacheImportedRows=" + result.importedRows();
    }

    private static String appendImportNote(String note, LocalOrcaMasterCacheImportService.ImportResult result) {
        String importNote = "affectedMasterTypes=" + String.join(",", result.affectedMasterTypes());
        if (note == null || note.isBlank()) {
            return importNote;
        }
        return note + " / " + importNote;
    }

    private static String sha256(byte[] payload) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of().formatHex(digest.digest(payload));
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 hash generation failed", ex);
        }
    }

    public static final class MasterUpdateException extends RuntimeException {

        private final int statusCode;
        private final String code;

        public MasterUpdateException(int statusCode, String code, String message) {
            super(message);
            this.statusCode = statusCode;
            this.code = code;
        }

        public int getStatusCode() {
            return statusCode;
        }

        public String getCode() {
            return code;
        }
    }

    static final class StreamedArtifactData {
        private final long size;
        private final String hash;

        private StreamedArtifactData(long size, String hash) {
            this.size = size;
            this.hash = hash;
        }

        long size() {
            return size;
        }

        String hash() {
            return hash;
        }
    }
}

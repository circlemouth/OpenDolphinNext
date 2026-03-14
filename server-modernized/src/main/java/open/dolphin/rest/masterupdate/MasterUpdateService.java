package open.dolphin.rest.masterupdate;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.runtime.RuntimeConfigurationSupport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Runtime service for dataset updates, versioning, and rollback.
 */
@ApplicationScoped
public class MasterUpdateService {

    private static final Logger LOGGER = LoggerFactory.getLogger(MasterUpdateService.class);
    private static final int MAX_VERSIONS_PER_DATASET = 20;

    private static final Pattern API_RESULT_PATTERN =
            Pattern.compile("<Api_Result\\b[^>]*>(.*?)</Api_Result>", Pattern.DOTALL);
    private static final Pattern API_MESSAGE_PATTERN =
            Pattern.compile("<Api_Result_Message\\b[^>]*>(.*?)</Api_Result_Message>", Pattern.DOTALL);
    private static final Pattern LAST_UPDATE_DATE_PATTERN =
            Pattern.compile("<(Last_Update_Date|Master_Update_Date)\\b[^>]*>(.*?)</(Last_Update_Date|Master_Update_Date)>", Pattern.DOTALL);

    @Inject
    private MasterUpdateStore store;

    @Inject
    private RestOrcaTransport restOrcaTransport;

    private HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(20))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public Map<String, Object> listDatasets(String runId) {
        MasterUpdateStore.Snapshot snapshot = store.getSnapshot();
        List<Map<String, Object>> datasets = new ArrayList<>();
        snapshot.datasets.values().stream()
                .sorted(Comparator.comparing(state -> state.code == null ? "" : state.code))
                .forEach(state -> datasets.add(toSummary(state)));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("generatedAt", Instant.now().toString());
        body.put("datasets", datasets);
        body.put("schedule", toScheduleMap(snapshot.schedule));
        return body;
    }

    public Map<String, Object> getDatasetDetail(String datasetCode, String runId) {
        MasterUpdateStore.Snapshot snapshot = store.getSnapshot();
        MasterUpdateStore.DatasetState state = requireDataset(snapshot, datasetCode);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("generatedAt", Instant.now().toString());
        body.put("dataset", toDetail(state));
        return body;
    }

    public Map<String, Object> runDataset(String datasetCode,
                                          String triggerType,
                                          String requestedBy,
                                          String runId,
                                          boolean force) {
        String normalizedCode = normalizeDatasetCode(datasetCode);
        String normalizedTrigger = triggerType == null || triggerType.isBlank() ? "MANUAL" : triggerType.trim();
        String actor = requestedBy == null || requestedBy.isBlank() ? "unknown" : requestedBy.trim();
        String now = Instant.now().toString();
        String jobId = UUID.randomUUID().toString();

        store.update(snapshot -> {
            MasterUpdateStore.DatasetState state = requireDataset(snapshot, normalizedCode);
            if (isRunning(state)) {
                throw new MasterUpdateException(409, "dataset_running", "更新処理は既に実行中です。");
            }
            state.lockJobId = jobId;
            state.lockStartedAt = now;
            state.status = "running";
            state.latestRunId = runId;
            state.latestJobMessage = "更新処理を開始しました";
            return null;
        });

        try {
            UpdateArtifact artifact = fetchDatasetArtifact(normalizedCode);
            String artifactPath = writeArtifact(normalizedCode, artifact, runId, normalizedTrigger);

            MasterUpdateStore.DatasetState updated = store.update(snapshot -> {
                MasterUpdateStore.DatasetState state = requireDataset(snapshot, normalizedCode);
                MasterUpdateStore.DatasetVersion previous = state.currentVersion();

                state.lastCheckedAt = now;
                state.latestRunId = runId;
                state.lastFailureAt = null;
                state.lastFailureReason = null;
                state.lastFailureDetail = null;
                state.lockJobId = null;
                state.lockStartedAt = null;
                if ("AUTO".equalsIgnoreCase(normalizedTrigger) || "AUTO_POLL".equalsIgnoreCase(normalizedTrigger)) {
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

                long previousCount = previous != null ? Math.max(0L, previous.recordCount) : 0L;
                long currentCount = Math.max(0L, artifact.recordCount);

                long addedCount = Math.max(0L, currentCount - previousCount);
                long removedCount = Math.max(0L, previousCount - currentCount);
                long changedCount = previousCount == currentCount ? 0L : Math.min(previousCount, currentCount) / 10L;

                for (MasterUpdateStore.DatasetVersion version : state.versions) {
                    version.current = false;
                }

                MasterUpdateStore.DatasetVersion version = new MasterUpdateStore.DatasetVersion();
                version.versionId = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + "-" + UUID.randomUUID().toString().substring(0, 8);
                version.capturedAt = now;
                version.status = "READY";
                version.hash = artifact.hash;
                version.recordCount = currentCount;
                version.artifactPath = artifactPath;
                version.sourceUrl = state.sourceUrl;
                version.summary = artifact.summary;
                version.triggerType = normalizedTrigger;
                version.requestedBy = actor;
                version.runId = runId;
                version.addedCount = addedCount;
                version.removedCount = removedCount;
                version.changedCount = changedCount;
                version.note = artifact.note;
                version.current = true;

                state.versions.add(0, version);
                while (state.versions.size() > MAX_VERSIONS_PER_DATASET) {
                    state.versions.remove(state.versions.size() - 1);
                }

                state.currentVersionId = version.versionId;
                state.currentRecordCount = version.recordCount;
                state.status = "normal";
                state.lastSuccessfulAt = now;
                state.latestJobMessage = "更新版を反映しました";
                state.updateDetected = false;
                return state;
            });

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("runId", runId);
            body.put("ok", true);
            body.put("message", "更新処理が完了しました。");
            body.put("dataset", toDetail(updated));
            body.put("triggerType", normalizedTrigger);
            body.put("artifactPath", artifactPath);
            return body;
        } catch (MasterUpdateException ex) {
            failDatasetRun(normalizedCode, runId, now, ex.getMessage());
            throw ex;
        } catch (Exception ex) {
            LOGGER.warn("Dataset update failed. dataset={} runId={} err={}", normalizedCode, runId, ex.getMessage(), ex);
            failDatasetRun(normalizedCode, runId, now, ex.getMessage());
            throw new MasterUpdateException(500, "dataset_update_failed", "更新処理に失敗しました: " + ex.getMessage());
        }
    }

    public Map<String, Object> uploadDataset(String datasetCode,
                                             String fileName,
                                             byte[] payload,
                                             String requestedBy,
                                             String runId) {
        String normalizedCode = normalizeDatasetCode(datasetCode);
        if (payload == null || payload.length == 0) {
            throw new MasterUpdateException(400, "empty_upload", "アップロードファイルが空です。");
        }

        MasterUpdateStore.Snapshot snapshot = store.getSnapshot();
        MasterUpdateStore.DatasetState dataset = requireDataset(snapshot, normalizedCode);
        if (!dataset.manualUploadAllowed) {
            throw new MasterUpdateException(400, "upload_not_allowed", "このデータセットは手動アップロードに対応していません。");
        }

        String extension = resolveExtension(fileName, null);
        String hash = sha256(payload);
        long recordCount = estimateRecordCount(payload, extension, null);
        String artifactPath = writeArtifact(normalizedCode, extension, payload, runId, "UPLOAD");
        String now = Instant.now().toString();

        MasterUpdateStore.DatasetState updated = store.update(stateSnapshot -> {
            MasterUpdateStore.DatasetState state = requireDataset(stateSnapshot, normalizedCode);
            MasterUpdateStore.DatasetVersion previous = state.currentVersion();
            for (MasterUpdateStore.DatasetVersion version : state.versions) {
                version.current = false;
            }

            long previousCount = previous != null ? Math.max(0L, previous.recordCount) : 0L;
            long currentCount = Math.max(0L, recordCount);

            MasterUpdateStore.DatasetVersion version = new MasterUpdateStore.DatasetVersion();
            version.versionId = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + "-" + UUID.randomUUID().toString().substring(0, 8);
            version.capturedAt = now;
            version.status = "READY";
            version.hash = hash;
            version.recordCount = currentCount;
            version.artifactPath = artifactPath;
            version.sourceUrl = state.sourceUrl;
            version.summary = "manual upload";
            version.triggerType = "UPLOAD";
            version.requestedBy = requestedBy;
            version.runId = runId;
            version.addedCount = Math.max(0L, currentCount - previousCount);
            version.removedCount = Math.max(0L, previousCount - currentCount);
            version.changedCount = previousCount == currentCount ? 0L : Math.min(previousCount, currentCount) / 10L;
            version.note = fileName;
            version.current = true;

            state.versions.add(0, version);
            while (state.versions.size() > MAX_VERSIONS_PER_DATASET) {
                state.versions.remove(state.versions.size() - 1);
            }

            state.currentVersionId = version.versionId;
            state.currentRecordCount = version.recordCount;
            state.status = "normal";
            state.lastCheckedAt = now;
            state.lastSuccessfulAt = now;
            state.lastFailureAt = null;
            state.lastFailureReason = null;
            state.lastFailureDetail = null;
            state.latestRunId = runId;
            state.latestJobMessage = "アップロード版を反映しました";
            state.updateDetected = false;
            return state;
        });

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("ok", true);
        body.put("message", "アップロード版を反映しました。");
        body.put("dataset", toDetail(updated));
        body.put("artifactPath", artifactPath);
        return body;
    }

    public Map<String, Object> rollbackDataset(String datasetCode,
                                               String versionId,
                                               String requestedBy,
                                               String runId) {
        String normalizedCode = normalizeDatasetCode(datasetCode);
        if (versionId == null || versionId.isBlank()) {
            throw new MasterUpdateException(400, "version_required", "ロールバック対象の versionId が必要です。");
        }
        String now = Instant.now().toString();

        MasterUpdateStore.DatasetState updated = store.update(snapshot -> {
            MasterUpdateStore.DatasetState state = requireDataset(snapshot, normalizedCode);
            if (isRunning(state)) {
                throw new MasterUpdateException(409, "dataset_running", "実行中のためロールバックできません。");
            }
            MasterUpdateStore.DatasetVersion target = null;
            for (MasterUpdateStore.DatasetVersion version : state.versions) {
                if (Objects.equals(versionId, version.versionId)) {
                    target = version;
                    break;
                }
            }
            if (target == null) {
                throw new MasterUpdateException(404, "version_not_found", "指定された versionId が見つかりません。");
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

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("ok", true);
        body.put("message", "ロールバックが完了しました。");
        body.put("requestedBy", requestedBy);
        body.put("dataset", toDetail(updated));
        return body;
    }

    public Map<String, Object> getSchedule(String runId) {
        MasterUpdateStore.Snapshot snapshot = store.getSnapshot();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("generatedAt", Instant.now().toString());
        body.put("schedule", toScheduleMap(snapshot.schedule));
        return body;
    }

    public Map<String, Object> updateSchedule(Map<String, Object> payload,
                                              String requestedBy,
                                              String runId) {
        MasterUpdateStore.ScheduleConfig updated = store.update(snapshot -> {
            MasterUpdateStore.ScheduleConfig schedule = snapshot.schedule != null
                    ? snapshot.schedule
                    : MasterUpdateStore.ScheduleConfig.defaults();

            if (payload != null) {
                String autoUpdateTime = asString(payload.get("autoUpdateTime"));
                Integer retryCount = asInteger(payload.get("retryCount"));
                Integer timeoutSeconds = asInteger(payload.get("timeoutSeconds"));
                Integer maxConcurrency = asInteger(payload.get("maxConcurrency"));
                Integer pollMinutes = asInteger(payload.get("orcaPollIntervalMinutes"));
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
                            schedule.datasetAutoEnabledOverrides.put(code, asBoolean(entry.getValue()));
                        }
                    }
                }
            }

            snapshot.schedule = MasterUpdateStore.ScheduleConfig.applyDefaults(schedule);
            return snapshot.schedule;
        });

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("ok", true);
        body.put("message", "スケジュールを更新しました。");
        body.put("updatedBy", requestedBy);
        body.put("schedule", toScheduleMap(updated));
        return body;
    }

    public Map<String, Object> getReferenceStatus(String runId) {
        MasterUpdateStore.Snapshot snapshot = store.getSnapshot();
        List<Map<String, Object>> datasets = new ArrayList<>();
        boolean hasFailure = false;
        boolean hasRunning = false;
        boolean hasUpdateDetected = false;

        for (MasterUpdateStore.DatasetState state : snapshot.datasets.values()) {
            Map<String, Object> row = toSummary(state);
            datasets.add(row);
            String status = asString(row.get("status"));
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
        MasterUpdateStore.Snapshot snapshot = store.getSnapshot();
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
            if (!autoEnabled) {
                continue;
            }
            if (isRunning(state)) {
                continue;
            }

            int intervalMinutes = state.defaultIntervalMinutes > 0 ? state.defaultIntervalMinutes : 1440;
            if ("orca_master_core".equals(state.code)) {
                intervalMinutes = Math.max(1, schedule.orcaPollIntervalMinutes);
            }

            Instant lastChecked = parseInstant(state.lastCheckedAt);
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

    private void failDatasetRun(String datasetCode, String runId, String now, String message) {
        store.update(snapshot -> {
            MasterUpdateStore.DatasetState state = requireDataset(snapshot, datasetCode);
            state.status = "failed";
            state.lastCheckedAt = now;
            state.lastFailureAt = now;
            state.lastFailureReason = summarizeFailure(message);
            state.lastFailureDetail = message;
            state.latestRunId = runId;
            state.latestJobMessage = "更新処理に失敗しました";
            state.lockJobId = null;
            state.lockStartedAt = null;
            return null;
        });
    }

    private UpdateArtifact fetchDatasetArtifact(String datasetCode) {
        if ("orca_master_core".equals(datasetCode)) {
            return fetchOrcaMasterArtifact();
        }
        MasterUpdateStore.DatasetState state = requireDataset(store.getSnapshot(), datasetCode);
        return fetchExternalArtifact(state.sourceUrl);
    }

    private UpdateArtifact fetchOrcaMasterArtifact() {
        if (restOrcaTransport == null) {
            throw new MasterUpdateException(503, "orca_transport_unavailable", "ORCA transport が利用できません。");
        }

        restOrcaTransport.reloadSettings();
        String requestXml = String.join("\n",
                "<data>",
                "  <masterlastupdatev3req type=\"record\">",
                "    <Request_Number type=\"string\">01</Request_Number>",
                "  </masterlastupdatev3req>",
                "</data>");

        OrcaTransportResult result = restOrcaTransport.invokeDetailed(
                OrcaEndpoint.MASTER_LAST_UPDATE,
                OrcaTransportRequest.post(requestXml)
        );
        if (result == null) {
            throw new MasterUpdateException(502, "orca_empty_response", "ORCA から応答を取得できませんでした。");
        }
        if (result.getStatus() < 200 || result.getStatus() >= 300) {
            throw new MasterUpdateException(
                    502,
                    "orca_http_error",
                    "ORCA masterlastupdatev3 が HTTP " + result.getStatus() + " を返しました。"
            );
        }

        String body = result.getBody() != null ? result.getBody() : "";
        String apiResult = extractFirst(API_RESULT_PATTERN, body);
        String apiMessage = extractFirst(API_MESSAGE_PATTERN, body);
        if (apiResult == null || !apiResult.matches("0+")) {
            throw new MasterUpdateException(
                    502,
                    "orca_api_error",
                    "ORCA masterlastupdatev3 の Api_Result が異常です: " + (apiResult != null ? apiResult : "(null)")
                            + (apiMessage != null ? " / " + apiMessage : "")
            );
        }

        String lastUpdateDate = extractLastUpdateDate(body);
        long versionRecords = Math.max(1L, countMasterVersionNodes(body));
        byte[] payload = body.getBytes(StandardCharsets.UTF_8);

        UpdateArtifact artifact = new UpdateArtifact();
        artifact.payload = payload;
        artifact.hash = sha256(payload);
        artifact.recordCount = versionRecords;
        artifact.summary = "Api_Result=" + apiResult + " / Last_Update_Date=" + (lastUpdateDate != null ? lastUpdateDate : "-");
        artifact.note = apiMessage;
        artifact.suggestedExtension = "xml";
        artifact.sourceUrl = "orca:masterlastupdatev3";
        return artifact;
    }

    private UpdateArtifact fetchExternalArtifact(String sourceUrl) {
        if (sourceUrl == null || sourceUrl.isBlank()) {
            throw new MasterUpdateException(400, "source_url_missing", "取得元URLが未設定です。");
        }

        HttpRequest request = HttpRequest.newBuilder(URI.create(sourceUrl.trim()))
                .GET()
                .timeout(Duration.ofSeconds(45))
                .header("User-Agent", "OpenDolphin-MasterUpdate/1.0")
                .build();

        HttpResponse<InputStream> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new MasterUpdateException(502, "external_fetch_failed", "外部データ取得に失敗しました: " + ex.getMessage());
        } catch (IOException ex) {
            throw new MasterUpdateException(502, "external_fetch_failed", "外部データ取得に失敗しました: " + ex.getMessage());
        }

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new MasterUpdateException(
                    502,
                    "external_http_error",
                    "外部データ取得が HTTP " + response.statusCode() + " で失敗しました。"
            );
        }

        String contentType = response.headers().firstValue("content-type").orElse(null);
        String extension = resolveExtension(sourceUrl, contentType);
        Path tempFile = null;
        try (InputStream body = response.body()) {
            if (body == null) {
                throw new MasterUpdateException(502, "external_empty", "外部データが空です。");
            }
            tempFile = createArtifactTempFile(extension);
            StreamedArtifactData streamed = streamToFile(body, tempFile);
            if (streamed.size <= 0L) {
                throw new MasterUpdateException(502, "external_empty", "外部データが空です。");
            }

            UpdateArtifact artifact = new UpdateArtifact();
            artifact.tempFile = tempFile;
            artifact.hash = streamed.hash;
            artifact.recordCount = estimateRecordCount(tempFile, extension, contentType);
            artifact.summary = "HTTP " + response.statusCode() + " / size=" + streamed.size;
            artifact.note = contentType;
            artifact.suggestedExtension = extension;
            artifact.sourceUrl = sourceUrl;
            artifact.payloadSize = streamed.size;
            return artifact;
        } catch (MasterUpdateException ex) {
            deleteTempFileQuietly(tempFile);
            throw ex;
        } catch (IOException ex) {
            deleteTempFileQuietly(tempFile);
            throw new MasterUpdateException(500, "artifact_stream_failed", "取得ファイルの一時保存に失敗しました: " + ex.getMessage());
        }
    }

    private String writeArtifact(String datasetCode,
                                 UpdateArtifact artifact,
                                 String runId,
                                 String triggerType) {
        if (artifact == null) {
            throw new MasterUpdateException(500, "artifact_missing", "取得ファイルがありません。");
        }
        return writeArtifact(datasetCode, artifact.suggestedExtension, artifact.payload, artifact.tempFile, runId, triggerType);
    }

    private String writeArtifact(String datasetCode,
                                 String extension,
                                 byte[] payload,
                                 Path tempFile,
                                 String runId,
                                 String triggerType) {
        String safeExtension = extension != null && !extension.isBlank() ? extension : "bin";
        String timestamp = Instant.now().toString().replace(':', '-');
        String fileName = timestamp + "-" + triggerType.toLowerCase(Locale.ROOT) + "-" + runId + "." + safeExtension;
        Path path = resolveArtifactRoot().resolve(datasetCode).resolve(fileName);
        try {
            Files.createDirectories(path.getParent());
            if (tempFile != null) {
                Files.move(tempFile, path);
            } else {
                Files.write(path, payload);
            }
        } catch (IOException ex) {
            deleteTempFileQuietly(tempFile);
            throw new MasterUpdateException(500, "artifact_write_failed", "取得ファイル保存に失敗しました: " + ex.getMessage());
        }
        return path.toString();
    }

    private String writeArtifact(String datasetCode,
                                 String extension,
                                 byte[] payload,
                                 String runId,
                                 String triggerType) {
        return writeArtifact(datasetCode, extension, payload, null, runId, triggerType);
    }

    private Path resolveArtifactRoot() {
        Path base = RuntimeConfigurationSupport.resolveServerDataDirectoryOrThrow("MasterUpdateService artifacts");
        return base.resolve("opendolphin").resolve("master-update-artifacts");
    }

    private static boolean isRunning(MasterUpdateStore.DatasetState state) {
        return state != null
                && state.lockJobId != null
                && !state.lockJobId.isBlank();
    }

    private static MasterUpdateStore.DatasetState requireDataset(MasterUpdateStore.Snapshot snapshot, String datasetCode) {
        String normalized = normalizeDatasetCode(datasetCode);
        MasterUpdateStore.DatasetState state = MasterUpdateStore.findDataset(snapshot, normalized);
        if (state == null) {
            throw new MasterUpdateException(404, "dataset_not_found", "指定されたデータセットが見つかりません: " + datasetCode);
        }
        return state;
    }

    private static String normalizeDatasetCode(String datasetCode) {
        if (datasetCode == null) {
            return null;
        }
        String normalized = datasetCode.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String asString(Object value) {
        return value instanceof String text ? text : null;
    }

    private static Integer asInteger(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignore) {
                return null;
            }
        }
        return null;
    }

    private static Boolean asBoolean(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof String text) {
            String normalized = text.trim().toLowerCase(Locale.ROOT);
            if ("1".equals(normalized) || "true".equals(normalized) || "on".equals(normalized)) {
                return true;
            }
            if ("0".equals(normalized) || "false".equals(normalized) || "off".equals(normalized)) {
                return false;
            }
        }
        return null;
    }

    private static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (RuntimeException ignore) {
            return null;
        }
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

    private static String sha256(byte[] payload) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(payload));
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 hash generation failed", ex);
        }
    }

    private static String extractFirst(Pattern pattern, String text) {
        if (pattern == null || text == null || text.isBlank()) {
            return null;
        }
        Matcher matcher = pattern.matcher(text);
        if (!matcher.find()) {
            return null;
        }
        String value = matcher.group(1);
        return value != null ? value.trim() : null;
    }

    private static String extractLastUpdateDate(String xml) {
        if (xml == null || xml.isBlank()) {
            return null;
        }
        Matcher matcher = LAST_UPDATE_DATE_PATTERN.matcher(xml);
        if (!matcher.find()) {
            return null;
        }
        String value = matcher.group(2);
        return value != null ? value.trim() : null;
    }

    private static long countMasterVersionNodes(String xml) {
        if (xml == null || xml.isBlank()) {
            return 0L;
        }
        long count = 0L;
        int idx = 0;
        String token = "Master_Version_Information";
        while (true) {
            idx = xml.indexOf(token, idx);
            if (idx < 0) {
                break;
            }
            count++;
            idx += token.length();
        }
        return count;
    }

    private static String resolveExtension(String source, String contentType) {
        if (source != null) {
            int queryIdx = source.indexOf('?');
            String path = queryIdx >= 0 ? source.substring(0, queryIdx) : source;
            int slashIdx = path.lastIndexOf('/');
            String fileName = slashIdx >= 0 ? path.substring(slashIdx + 1) : path;
            int dotIdx = fileName.lastIndexOf('.');
            if (dotIdx > 0 && dotIdx < fileName.length() - 1) {
                String ext = fileName.substring(dotIdx + 1).toLowerCase(Locale.ROOT);
                if (ext.matches("[a-z0-9]{1,8}")) {
                    return ext;
                }
            }
        }
        if (contentType != null) {
            String lowered = contentType.toLowerCase(Locale.ROOT);
            if (lowered.contains("json")) {
                return "json";
            }
            if (lowered.contains("xml")) {
                return "xml";
            }
            if (lowered.contains("csv")) {
                return "csv";
            }
            if (lowered.contains("zip")) {
                return "zip";
            }
            if (lowered.contains("pdf")) {
                return "pdf";
            }
            if (lowered.contains("text")) {
                return "txt";
            }
        }
        return "bin";
    }

    static long estimateRecordCount(byte[] payload, String extension, String contentType) {
        if (payload == null || payload.length == 0) {
            return 0L;
        }
        String ext = extension != null ? extension.toLowerCase(Locale.ROOT) : "";
        String type = contentType != null ? contentType.toLowerCase(Locale.ROOT) : "";

        if ("zip".equals(ext) || type.contains("zip")) {
            long entries = 0L;
            try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(payload))) {
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    if (!entry.isDirectory()) {
                        entries++;
                    }
                }
                return Math.max(1L, entries);
            } catch (IOException ignore) {
                return 1L;
            }
        }

        if ("csv".equals(ext)
                || "txt".equals(ext)
                || "json".equals(ext)
                || "xml".equals(ext)
                || type.contains("text")
                || type.contains("csv")
                || type.contains("json")
                || type.contains("xml")) {
            String text = new String(payload, StandardCharsets.UTF_8);
            long lines = text.lines().count();
            return Math.max(1L, lines);
        }

        return 1L;
    }

    static long estimateRecordCount(Path artifactPath, String extension, String contentType) {
        if (artifactPath == null || !Files.exists(artifactPath)) {
            return 0L;
        }
        String ext = extension != null ? extension.toLowerCase(Locale.ROOT) : "";
        String type = contentType != null ? contentType.toLowerCase(Locale.ROOT) : "";

        if ("zip".equals(ext) || type.contains("zip")) {
            long entries = 0L;
            try (InputStream in = Files.newInputStream(artifactPath);
                 ZipInputStream zip = new ZipInputStream(in)) {
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    if (!entry.isDirectory()) {
                        entries++;
                    }
                }
                return Math.max(1L, entries);
            } catch (IOException ignore) {
                return 1L;
            }
        }

        if ("csv".equals(ext)
                || "txt".equals(ext)
                || "json".equals(ext)
                || "xml".equals(ext)
                || type.contains("text")
                || type.contains("csv")
                || type.contains("json")
                || type.contains("xml")) {
            try {
                long lines;
                try (java.util.stream.Stream<String> stream = Files.lines(artifactPath, StandardCharsets.UTF_8)) {
                    lines = stream.count();
                }
                return Math.max(1L, lines);
            } catch (IOException ignore) {
                return 1L;
            }
        }

        return 1L;
    }

    static StreamedArtifactData streamToFile(InputStream input, Path target) throws IOException {
        Objects.requireNonNull(input, "input");
        Objects.requireNonNull(target, "target");
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long size = 0L;
            try (OutputStream out = Files.newOutputStream(target)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    size += read;
                }
            }
            return new StreamedArtifactData(size, HexFormat.of().formatHex(digest.digest()));
        } catch (MasterUpdateException ex) {
            throw ex;
        } catch (IOException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IOException("Failed to hash streamed artifact", ex);
        }
    }

    private Path createArtifactTempFile(String extension) throws IOException {
        String safeExtension = extension != null && !extension.isBlank() ? extension : "bin";
        Path tempDir = resolveArtifactRoot().resolve(".tmp");
        Files.createDirectories(tempDir);
        return Files.createTempFile(tempDir, "master-update-", "." + safeExtension);
    }

    private static void deleteTempFileQuietly(Path tempFile) {
        if (tempFile == null) {
            return;
        }
        try {
            Files.deleteIfExists(tempFile);
        } catch (IOException ignore) {
            // best effort cleanup
        }
    }

    private static Map<String, Object> toSummary(MasterUpdateStore.DatasetState state) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("code", state.code);
        row.put("name", state.name);
        row.put("sourceUrl", state.sourceUrl);
        row.put("updateFrequency", state.updateFrequency);
        row.put("format", state.format);
        row.put("usageNotes", state.usageNotes);
        row.put("active", state.active);
        row.put("autoEnabled", state.autoEnabled);
        row.put("manualUploadAllowed", state.manualUploadAllowed);
        row.put("status", state.status);
        row.put("lastCheckedAt", state.lastCheckedAt);
        row.put("lastSuccessfulAt", state.lastSuccessfulAt);
        row.put("lastFailureAt", state.lastFailureAt);
        row.put("lastFailureReason", state.lastFailureReason);
        row.put("latestRunId", state.latestRunId);
        row.put("latestJobMessage", state.latestJobMessage);
        row.put("currentVersionId", state.currentVersionId);
        row.put("currentRecordCount", state.currentRecordCount);
        row.put("updateDetected", state.updateDetected);
        row.put("lastAutoRunAt", state.lastAutoRunAt);
        row.put("lastPolledAt", state.lastPolledAt);
        row.put("running", isRunning(state));

        MasterUpdateStore.DatasetVersion current = state.currentVersion();
        if (current != null) {
            row.put("currentCapturedAt", current.capturedAt);
            row.put("currentHash", current.hash);
            row.put("currentSummary", current.summary);
        }
        row.put("versionCount", state.versions != null ? state.versions.size() : 0);
        return row;
    }

    private static Map<String, Object> toDetail(MasterUpdateStore.DatasetState state) {
        Map<String, Object> detail = toSummary(state);
        List<Map<String, Object>> versions = new ArrayList<>();
        if (state.versions != null) {
            for (MasterUpdateStore.DatasetVersion version : state.versions) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("versionId", version.versionId);
                row.put("capturedAt", version.capturedAt);
                row.put("status", version.status);
                row.put("hash", version.hash);
                row.put("recordCount", version.recordCount);
                row.put("artifactPath", version.artifactPath);
                row.put("sourceUrl", version.sourceUrl);
                row.put("summary", version.summary);
                row.put("triggerType", version.triggerType);
                row.put("requestedBy", version.requestedBy);
                row.put("runId", version.runId);
                row.put("addedCount", version.addedCount);
                row.put("removedCount", version.removedCount);
                row.put("changedCount", version.changedCount);
                row.put("note", version.note);
                row.put("current", version.current);
                versions.add(row);
            }
        }
        detail.put("versions", versions);
        return detail;
    }

    private static Map<String, Object> toScheduleMap(MasterUpdateStore.ScheduleConfig config) {
        MasterUpdateStore.ScheduleConfig source = config != null
                ? config
                : MasterUpdateStore.ScheduleConfig.defaults();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("autoUpdateTime", source.autoUpdateTime);
        map.put("retryCount", source.retryCount);
        map.put("timeoutSeconds", source.timeoutSeconds);
        map.put("maxConcurrency", source.maxConcurrency);
        map.put("orcaPollIntervalMinutes", source.orcaPollIntervalMinutes);
        map.put("datasetAutoEnabledOverrides", source.datasetAutoEnabledOverrides);
        return map;
    }

    private static final class UpdateArtifact {
        private byte[] payload;
        private Path tempFile;
        private long payloadSize;
        private String hash;
        private long recordCount;
        private String summary;
        private String note;
        private String suggestedExtension;
        private String sourceUrl;
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

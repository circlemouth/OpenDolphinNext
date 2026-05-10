package open.dolphin.rest.masterupdate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class MasterUpdatePayloads {

    private static final Pattern OFFICIAL_LAST_UPDATE_PATTERN =
            Pattern.compile("(?:Last_Update_Date|Master_Update_Date)=([^\\s/]+)");

    private MasterUpdatePayloads() {
    }

    static Map<String, Object> toSummary(MasterUpdateStore.DatasetState state) {
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
        row.put("running", MasterUpdateStateSupport.isRunning(state));
        row.put("officialSource", toOfficialSource(state));
        row.put("localArtifacts", toLocalArtifactSummary(state));

        MasterUpdateStore.DatasetVersion current = state.currentVersion();
        if (current != null) {
            row.put("currentCapturedAt", current.capturedAt);
            row.put("currentHash", current.hash);
            row.put("currentSummary", current.summary);
        }
        row.put("versionCount", state.versions != null ? state.versions.size() : 0);
        return row;
    }

    static Map<String, Object> toDetail(MasterUpdateStore.DatasetState state) {
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
                row.put("sourceKind", resolveVersionSourceKind(version));
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
        detail.put("localArtifacts", toLocalArtifactDetail(state, versions));
        return detail;
    }

    private static Map<String, Object> toOfficialSource(MasterUpdateStore.DatasetState state) {
        MasterUpdateStore.DatasetVersion referenceVersion = resolveLatestOfficialVersion(state);
        Map<String, Object> official = new LinkedHashMap<>();
        boolean masterLastUpdateDataset = isOrcaMasterLastUpdateDataset(state.code);
        official.put("kind", masterLastUpdateDataset ? "masterlastupdatev3" : "external_source");
        official.put("label", masterLastUpdateDataset ? "official masterlastupdatev3" : "official source metadata");
        official.put("sourceUrl", state.sourceUrl);
        official.put("updateFrequency", state.updateFrequency);
        official.put("format", state.format);
        official.put("usageNotes", state.usageNotes);
        official.put("lastCheckedAt", state.lastCheckedAt);
        official.put("lastPolledAt", state.lastPolledAt);
        official.put("updateDetected", state.updateDetected);
        official.put("latestRunId", state.latestRunId);
        official.put("latestJobMessage", state.latestJobMessage);
        official.put("officialLastUpdateDate", extractOfficialLastUpdateDate(referenceVersion != null ? referenceVersion.summary : null));
        official.put("officialCapturedAt", referenceVersion != null ? referenceVersion.capturedAt : null);
        official.put("officialSummary", referenceVersion != null ? referenceVersion.summary : null);
        return official;
    }

    private static boolean isOrcaMasterLastUpdateDataset(String datasetCode) {
        return "orca_master_core".equals(datasetCode) || "disease_master".equals(datasetCode);
    }

    private static Map<String, Object> toLocalArtifactSummary(MasterUpdateStore.DatasetState state) {
        Map<String, Object> local = new LinkedHashMap<>();
        local.put("manualUploadAllowed", state.manualUploadAllowed);
        local.put("currentVersionId", state.currentVersionId);
        local.put("currentRecordCount", state.currentRecordCount);
        MasterUpdateStore.DatasetVersion current = state.currentVersion();
        if (current != null) {
            local.put("currentCapturedAt", current.capturedAt);
            local.put("currentHash", current.hash);
            local.put("currentSummary", current.summary);
            local.put("currentArtifactPath", current.artifactPath);
        }
        local.put("versionCount", state.versions != null ? state.versions.size() : 0);
        return local;
    }

    private static Map<String, Object> toLocalArtifactDetail(MasterUpdateStore.DatasetState state, List<Map<String, Object>> versions) {
        Map<String, Object> local = toLocalArtifactSummary(state);
        local.put("versions", versions);
        return local;
    }

    private static String resolveVersionSourceKind(MasterUpdateStore.DatasetVersion version) {
        if (version == null) {
            return null;
        }
        if ("UPLOAD".equalsIgnoreCase(version.triggerType)) {
            return "local_upload";
        }
        return "official_fetch";
    }

    private static MasterUpdateStore.DatasetVersion resolveLatestOfficialVersion(MasterUpdateStore.DatasetState state) {
        if (state == null || state.versions == null || state.versions.isEmpty()) {
            return null;
        }
        for (MasterUpdateStore.DatasetVersion version : state.versions) {
            if (!"local_upload".equals(resolveVersionSourceKind(version))) {
                return version;
            }
        }
        return null;
    }

    private static String extractOfficialLastUpdateDate(String summary) {
        if (summary == null || summary.isBlank()) {
            return null;
        }
        Matcher matcher = OFFICIAL_LAST_UPDATE_PATTERN.matcher(summary);
        if (!matcher.find()) {
            return null;
        }
        String value = matcher.group(1);
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    static Map<String, Object> toScheduleMap(MasterUpdateStore.ScheduleConfig config) {
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

    static String asString(Object value) {
        return value instanceof String text ? text : null;
    }

    static Integer asInteger(Object value) {
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

    static Optional<Boolean> asBoolean(Object value) {
        if (value instanceof Boolean bool) {
            return Optional.of(bool);
        }
        if (value instanceof String text) {
            String normalized = text.trim().toLowerCase(Locale.ROOT);
            if ("1".equals(normalized) || "true".equals(normalized) || "on".equals(normalized)) {
                return Optional.of(Boolean.TRUE);
            }
            if ("0".equals(normalized) || "false".equals(normalized) || "off".equals(normalized)) {
                return Optional.of(Boolean.FALSE);
            }
        }
        return Optional.empty();
    }

    static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (RuntimeException ignore) {
            return null;
        }
    }
}

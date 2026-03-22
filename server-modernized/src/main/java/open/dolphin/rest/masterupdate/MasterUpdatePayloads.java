package open.dolphin.rest.masterupdate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class MasterUpdatePayloads {

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

    static Boolean asBoolean(Object value) {
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

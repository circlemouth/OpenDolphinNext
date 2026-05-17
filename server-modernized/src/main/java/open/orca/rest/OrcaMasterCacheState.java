package open.orca.rest;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.rest.dto.orca.OrcaMasterMeta;

/**
 * Sanitized provenance for OpenDolphin local master cache responses.
 */
public final class OrcaMasterCacheState {

    public static final String STATUS_CURRENT = "CURRENT";
    public static final String STATUS_STALE = "STALE";
    public static final String STATUS_NOT_IMPORTED = "NOT_IMPORTED";
    public static final String STATUS_UNAVAILABLE = "UNAVAILABLE";

    private final String sourceSystem;
    private final String sourceKind;
    private final String sourceApi;
    private final String sourceFile;
    private final String masterType;
    private final String masterVersion;
    private final String effectiveFrom;
    private final String effectiveTo;
    private final String importedAt;
    private final boolean stale;
    private final String unavailableReason;
    private final String cacheStatus;

    public OrcaMasterCacheState(String sourceSystem, String sourceKind, String sourceApi, String sourceFile,
            String masterType, String masterVersion, String effectiveFrom, String effectiveTo, String importedAt,
            boolean stale, String unavailableReason, String cacheStatus) {
        this.sourceSystem = firstNonBlank(sourceSystem, "OpenDolphinLocalMasterCache");
        this.sourceKind = firstNonBlank(sourceKind, "local-cache");
        this.sourceApi = sourceApi;
        this.sourceFile = sourceFile;
        this.masterType = masterType;
        this.masterVersion = masterVersion;
        this.effectiveFrom = effectiveFrom;
        this.effectiveTo = effectiveTo;
        this.importedAt = importedAt;
        this.stale = stale || STATUS_STALE.equals(cacheStatus);
        this.unavailableReason = unavailableReason;
        this.cacheStatus = firstNonBlank(cacheStatus, STATUS_CURRENT);
    }

    public static OrcaMasterCacheState current(String masterType, String version) {
        return new OrcaMasterCacheState(
                "OpenDolphinLocalMasterCache",
                "local-cache",
                null,
                null,
                masterType,
                version,
                OrcaMasterService.DEFAULT_VALID_FROM,
                OrcaMasterService.DEFAULT_VALID_TO,
                Instant.now().toString(),
                false,
                null,
                STATUS_CURRENT);
    }

    static OrcaMasterCacheState syntheticCurrent(String masterType, String version) {
        return new OrcaMasterCacheState(
                "OpenDolphinLocalMasterCache",
                "local-cache",
                null,
                null,
                masterType,
                version,
                OrcaMasterService.DEFAULT_VALID_FROM,
                OrcaMasterService.DEFAULT_VALID_TO,
                null,
                false,
                null,
                STATUS_CURRENT);
    }

    public static OrcaMasterCacheState notImported(String masterType) {
        return new OrcaMasterCacheState(
                "OpenDolphinLocalMasterCache",
                "local-cache",
                null,
                null,
                masterType,
                null,
                null,
                null,
                null,
                false,
                "not_imported",
                STATUS_NOT_IMPORTED);
    }

    public static OrcaMasterCacheState unavailable(String masterType) {
        return new OrcaMasterCacheState(
                "OpenDolphinLocalMasterCache",
                "local-cache",
                null,
                null,
                masterType,
                null,
                null,
                null,
                null,
                false,
                "backend_unavailable",
                STATUS_UNAVAILABLE);
    }

    public boolean isUnavailable() {
        return STATUS_NOT_IMPORTED.equals(cacheStatus) || STATUS_UNAVAILABLE.equals(cacheStatus);
    }

    public String cacheStatus() {
        return cacheStatus;
    }

    public String masterVersion() {
        return masterVersion;
    }

    public String importedAt() {
        return importedAt;
    }

    public OrcaMasterMeta toMeta() {
        OrcaMasterMeta meta = new OrcaMasterMeta();
        applyTo(meta);
        return meta;
    }

    public void applyTo(OrcaMasterMeta meta) {
        if (meta == null) {
            return;
        }
        meta.setSourceSystem(sourceSystem);
        meta.setSourceKind(sourceKind);
        meta.setSourceApi(sourceApi);
        meta.setSourceFile(sourceFile);
        meta.setMasterType(masterType);
        meta.setMasterVersion(masterVersion);
        meta.setEffectiveFrom(effectiveFrom);
        meta.setEffectiveTo(effectiveTo);
        meta.setImportedAt(importedAt);
        meta.setStale(stale);
        meta.setUnavailableReason(unavailableReason);
        meta.setCacheStatus(cacheStatus);
    }

    public Map<String, Object> toAuditDetails() {
        Map<String, Object> details = new LinkedHashMap<>();
        put(details, "sourceSystem", sourceSystem);
        put(details, "sourceKind", sourceKind);
        put(details, "sourceApi", sourceApi);
        put(details, "sourceFile", sourceFile);
        put(details, "cacheMasterType", masterType);
        put(details, "masterVersion", masterVersion);
        put(details, "effectiveFrom", effectiveFrom);
        put(details, "effectiveTo", effectiveTo);
        put(details, "importedAt", importedAt);
        details.put("stale", stale);
        put(details, "unavailableReason", unavailableReason);
        put(details, "cacheStatus", cacheStatus);
        return details;
    }

    private static void put(Map<String, Object> target, String key, String value) {
        if (value != null && !value.isBlank()) {
            target.put(key, value);
        }
    }

    private static String firstNonBlank(String... candidates) {
        if (candidates == null) {
            return null;
        }
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate;
            }
        }
        return null;
    }
}

package open.dolphin.security.audit;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class AuditEventAllowlist {

    private static final Set<String> DEFAULT_KEYS = normalizedSet(
            "status",
            "outcome",
            "reason",
            "errorCode",
            "errorMessage",
            "httpStatus",
            "validationError",
            "runId",
            "traceId",
            "requestId",
            "resource",
            "operation",
            "facilityId",
            "userId",
            "createdUserId",
            "actionType",
            "masterType",
            "snapshotVersion",
            "version",
            "cacheHit",
            "missingMaster",
            "fallbackUsed",
            "resultCount",
            "totalCount",
            "rowCount",
            "emptyResult",
            "page",
            "size",
            "method",
            "scope",
            "srycd",
            "category",
            "asOf",
            "tensuVersion",
            "loadFailed",
            "dbTimeMs",
            "mutationType",
            "letterId",
            "linkId",
            "letterType",
            "consultantHospital",
            "itemCount",
            "textCount",
            "dateCount",
            "karteId",
            "documentId",
            "currentStatus",
            "requestedStatus",
            "requiredEnv",
            "requiredHeader",
            "unsupportedHeader",
            "labCode",
            "firstResult",
            "maxResult",
            "itemCode",
            "sampleDate",
            "moduleKey",
            "laboModuleId",
            "moduleId",
            "orcaTransport",
            "class",
            "classCode",
            "startYear",
            "startMonth",
            "monthsRequested",
            "targetYear",
            "targetMonth",
            "deniedReason",
            "sessionOperation",
            "slot",
            "payloadCount",
            "affectedRows",
            "createdMemoIds",
            "updatedMemoIds",
            "deletedMemoIds",
            "createdAllergyIds",
            "updatedAllergyIds",
            "deletedAllergyIds",
            "diagnosisCodes",
            "updatedDiagnosisIds",
            "deletedDiagnosisIds",
            "deletedDocGroup",
            "requestedDocPk",
            "vitalDate",
            "vitalTime",
            "vitalId",
            "observationIds",
            "createdDocIds",
            "updatedDocIds",
            "deletedDocIds",
            "createdStampIds",
            "updatedStampIds",
            "deletedStampIds",
            "createdImageIds",
            "updatedImageIds",
            "deletedImageIds",
            "jobId",
            "artifactId",
            "signedUrlIssuer",
            "storageType",
            "signedUrlTtlSeconds",
            "tokenPresent",
            "tokenHash",
            "tokenHashAlg",
            "tokenAlgorithm",
            "auditSummary",
            "exception");

    private static final Set<String> ERROR_KEYS = merge(DEFAULT_KEYS, normalizedSet(
            "status",
            "reason",
            "errorCode",
            "errorMessage",
            "httpStatus",
            "validationError",
            "facilityId",
            "exception"));

    private static final Map<String, Set<String>> ACTION_KEYS = buildActionKeys();

    private AuditEventAllowlist() {
    }

    static boolean isAllowed(String action, String normalizedKey) {
        if (normalizedKey == null || normalizedKey.isBlank()) {
            return false;
        }
        if (isAlwaysDropped(normalizedKey)) {
            return false;
        }
        Set<String> allowlist = ACTION_KEYS.get(normalizeAction(action));
        if (allowlist != null && allowlist.contains(normalizedKey)) {
            return true;
        }
        return DEFAULT_KEYS.contains(normalizedKey);
    }

    private static boolean isAlwaysDropped(String normalizedKey) {
        if (normalizedKey == null || normalizedKey.isBlank()) {
            return true;
        }
        if ("patientid".equals(normalizedKey)
                || "patient_id".equals(normalizedKey)
                || "query".equals(normalizedKey)
                || "querystring".equals(normalizedKey)
                || "query_string".equals(normalizedKey)
                || "rawquery".equals(normalizedKey)
                || "keyword".equals(normalizedKey)
                || "kw".equals(normalizedKey)) {
            return true;
        }
        if (normalizedKey.contains("authorization")
                || normalizedKey.contains("cookie")
                || normalizedKey.contains("xml")
                || normalizedKey.contains("query")) {
            return true;
        }
        return false;
    }

    private static Map<String, Set<String>> buildActionKeys() {
        Map<String, Set<String>> keys = new LinkedHashMap<>();
        keys.put("REST_UNAUTHORIZED_GUARD", ERROR_KEYS);
        keys.put("REST_ERROR_RESPONSE", ERROR_KEYS);
        keys.put("ORCA_MASTER_FETCH", merge(DEFAULT_KEYS, normalizedSet(
                "keywordPresent",
                "keywordLength")));
        keys.put("CHART_REVISION_EVENT_RECORDED", merge(DEFAULT_KEYS, normalizedSet(
                "subjectType",
                "subjectId",
                "chartId",
                "sourceRevisionId",
                "sourceRevisionNumber",
                "sourceRevisionStatus",
                "newRevisionId",
                "newRevisionNumber",
                "eventId",
                "eventType",
                "contentHash",
                "hasReasonCode")));
        return Map.copyOf(keys);
    }

    private static String normalizeAction(String action) {
        if (action == null) {
            return "";
        }
        return action.trim().toUpperCase(Locale.ROOT);
    }

    private static Set<String> normalizedSet(String... keys) {
        Set<String> normalized = new LinkedHashSet<>();
        Arrays.stream(keys)
                .map(AuditDetailSanitizer::normalizeKey)
                .filter(value -> value != null && !value.isBlank())
                .forEach(normalized::add);
        return Set.copyOf(normalized);
    }

    private static Set<String> merge(Set<String> left, Set<String> right) {
        Set<String> merged = new LinkedHashSet<>(left);
        merged.addAll(right);
        return Set.copyOf(merged);
    }
}

package open.dolphin.rest.orca;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.time.temporal.TemporalAccessor;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.rest.dto.orca.OrcaApiResponse;
import open.dolphin.rest.orca.AbstractOrcaRestResource;

/**
 * Shared audit helpers for ORCA wrapper endpoints.
 */
public abstract class AbstractOrcaWrapperResource extends AbstractOrcaRestResource {

    protected static final String AUDIT_APPOINTMENT_OUTPATIENT_ACTION = "ORCA_OFFICIAL_APPOINTMENT_OUTPATIENT";
    protected static final String AUDIT_SYNC_PATIENTS_ACTION = "ORCA_OFFICIAL_SYNC_PATIENTS";
    private static final String DATA_SOURCE_SERVER = "server";
    private static final String TRACE_HEADER = "X-Request-Id";
    protected Map<String, Object> newAuditDetails(HttpServletRequest request) {
        Map<String, Object> details = new LinkedHashMap<>();
        String resourcePath = request != null ? request.getRequestURI() : null;
        String scope = resolveAuditScope(resourcePath);
        details.put("runId", resolveRunId(request));
        details.put("dataSource", DATA_SOURCE_SERVER);
        details.put("dataSourceTransition", DATA_SOURCE_SERVER);
        details.put("cacheHit", false);
        details.put("missingMaster", false);
        details.put("fallbackUsed", false);
        details.put("fetchedAt", Instant.now().toString());
        if (scope != null && !scope.isBlank()) {
            details.put("scope", scope);
        }

        String facilityId = actorFacilityId(request);
        if (facilityId != null && !facilityId.isBlank()) {
            details.put("facilityId", facilityId);
        }

        String traceId = resolveTraceId(request);
        String requestId = request != null ? request.getHeader(TRACE_HEADER) : null;
        if (requestId != null && !requestId.isBlank()) {
            requestId = requestId.trim();
            details.put("requestId", requestId);
        }
        if ((traceId == null || traceId.isBlank()) && requestId != null && !requestId.isBlank()) {
            traceId = requestId;
        }
        if (traceId != null && !traceId.isBlank()) {
            details.put("traceId", traceId);
            if (requestId == null || requestId.isBlank()) {
                details.put("requestId", traceId);
            }
        }
        return details;
    }

    protected void applyResponseAuditDetails(OrcaApiResponse response, Map<String, Object> details) {
        if (response == null || details == null) {
            return;
        }
        if (response.getRunId() != null && !response.getRunId().isBlank()) {
            String existing = extractDetailText(details, "runId");
            if (existing == null || existing.isBlank()) {
                details.put("runId", response.getRunId());
            }
        }
        if (response.getApiResult() != null && !response.getApiResult().isBlank()) {
            details.put("apiResult", response.getApiResult());
        }
        if (response.getApiResultMessage() != null && !response.getApiResultMessage().isBlank()) {
            details.put("apiResultMessage", response.getApiResultMessage());
        }
        if (response.getBlockerTag() != null && !response.getBlockerTag().isBlank()) {
            details.put("blockerTag", response.getBlockerTag());
        }
        if (response.getDataSource() != null && !response.getDataSource().isBlank()) {
            details.put("orcaMode", response.getDataSource());
        }
        if (response.getRecordsReturned() != null) {
            details.put("recordsReturned", response.getRecordsReturned());
        }
    }

    protected void applyResponseMetadata(OrcaApiResponse response, Map<String, Object> details) {
        if (response == null) {
            return;
        }
        String resolvedRunId = extractDetailText(details, "runId");
        if (resolvedRunId != null && !resolvedRunId.isBlank()) {
            response.setRunId(resolvedRunId);
        }
        String traceId = extractDetailText(details, "traceId");
        if (traceId != null && (response.getTraceId() == null || response.getTraceId().isBlank())) {
            response.setTraceId(traceId);
        }
        String requestId = extractDetailText(details, "requestId");
        if (requestId == null || requestId.isBlank()) {
            requestId = traceId;
        }
        if (requestId != null && (response.getRequestId() == null || response.getRequestId().isBlank())) {
            response.setRequestId(requestId);
        }
        if (response.getDataSourceTransition() == null || response.getDataSourceTransition().isBlank()) {
            String transition = extractDetailText(details, "dataSourceTransition");
            if (transition == null || transition.isBlank()) {
                transition = response.getDataSource();
            }
            if (transition != null && !transition.isBlank()) {
                response.setDataSourceTransition(transition);
            }
        }
        if (!response.isCacheHit()) {
            boolean cacheHit = extractDetailBoolean(details, "cacheHit");
            if (cacheHit) {
                response.setCacheHit(true);
            }
        }
        if (!response.isMissingMaster()) {
            boolean missingMaster = extractDetailBoolean(details, "missingMaster");
            if (missingMaster) {
                response.setMissingMaster(true);
            }
        }
        if (!response.isFallbackUsed()) {
            boolean fallbackUsed = extractDetailBoolean(details, "fallbackUsed");
            if (fallbackUsed) {
                response.setFallbackUsed(true);
            }
        }
        String fetchedAt = extractDetailText(details, "fetchedAt");
        if (fetchedAt != null && !fetchedAt.isBlank()) {
            response.setFetchedAt(fetchedAt);
        }
        if (response.getFetchedAt() == null || response.getFetchedAt().isBlank()) {
            response.setFetchedAt(Instant.now().toString());
        }
    }

    protected void markFailureDetails(Map<String, Object> details, int httpStatus, String errorCode, String errorMessage) {
        if (details == null) {
            return;
        }
        details.put("status", "failed");
        details.put("httpStatus", httpStatus);
        if (errorCode != null && !errorCode.isBlank()) {
            details.put("errorCode", errorCode);
        }
        if (errorMessage != null && !errorMessage.isBlank()) {
            details.put("errorMessage", errorMessage);
        }
    }

    protected void markSuccessDetails(Map<String, Object> details) {
        if (details == null) {
            return;
        }
        details.put("status", "success");
    }

    /**
     * Audit payload uses a plain ObjectMapper without JavaTime modules, so temporal values are
     * normalized to ISO-8601 strings before serialization.
     */
    protected void putAuditDetail(Map<String, Object> details, String key, Object value) {
        if (details == null || key == null || key.isBlank()) {
            return;
        }
        if (value instanceof TemporalAccessor) {
            details.put(key, value.toString());
            return;
        }
        details.put(key, value);
    }

    @Override
    protected String requireFacilityId(HttpServletRequest request) {
        String facility = actorFacilityId(request);
        if (facility == null || facility.isBlank()) {
            throw restError(request, Response.Status.UNAUTHORIZED, "facility_missing",
                    "Facility is required");
        }
        return facility;
    }

    protected String actorFacilityId(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String remoteUser = request.getRemoteUser();
        if (remoteUser == null || remoteUser.indexOf(IInfoModel.COMPOSITE_KEY_MAKER) < 0) {
            return null;
        }
        return getRemoteFacility(remoteUser);
    }

    private String extractDetailText(Map<String, Object> details, String key) {
        if (details == null || key == null) {
            return null;
        }
        Object value = details.get(key);
        if (value instanceof String text && !text.isBlank()) {
            return text;
        }
        return null;
    }

    private boolean extractDetailBoolean(Map<String, Object> details, String key) {
        if (details == null || key == null) {
            return false;
        }
        Object value = details.get(key);
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof String text) {
            if ("true".equalsIgnoreCase(text)) {
                return Boolean.TRUE;
            }
            if ("false".equalsIgnoreCase(text)) {
                return false;
            }
        }
        return false;
    }
}

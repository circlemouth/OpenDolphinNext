package open.orca.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.rest.AbstractResource;
import open.dolphin.rest.dto.orca.OrcaMasterErrorResponse;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;

class OrcaMasterAuditSupport extends AbstractResource {

    private final SessionAuditDispatcher sessionAuditDispatcher;

    OrcaMasterAuditSupport(SessionAuditDispatcher sessionAuditDispatcher) {
        this.sessionAuditDispatcher = sessionAuditDispatcher;
    }

    Response validationError(HttpServletRequest request, String code, String message) {
        OrcaMasterErrorResponse response = new OrcaMasterErrorResponse();
        response.setCode(code);
        response.setError(code);
        response.setErrorCode(code);
        response.setMessage(message);
        response.setStatus(422);
        response.setRunId(resolveRunId(request));
        response.setTimestamp(Instant.now().toString());
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            response.setCorrelationId(traceId);
            response.setTraceId(traceId);
        }
        response.setValidationError(Boolean.TRUE);
        response.setPath(request != null ? request.getRequestURI() : "/orca/master");
        response.setErrorCategory("validation_error");
        return Response.status(422).entity(response).build();
    }

    Response badRequest(HttpServletRequest request, String code, String message) {
        return buildErrorResponse(Status.BAD_REQUEST, code, message, request, null);
    }

    Response notFound(String code, String message, HttpServletRequest request) {
        return buildErrorResponse(Status.NOT_FOUND, code, message, request, null);
    }

    Response serviceUnavailable(HttpServletRequest request, String code, String message) {
        return buildErrorResponse(Status.SERVICE_UNAVAILABLE, code, message, request, null);
    }

    void recordMasterAudit(HttpServletRequest request, String apiRoute, String masterType, int httpStatus,
            OrcaMasterService.LoadedFixture<?> fixture, boolean cacheHit, Boolean emptyResult, Integer resultCount,
            Map<String, Object> extraDetails) {
        recordMasterAudit(request, apiRoute, masterType, httpStatus, fixture, cacheHit, emptyResult, resultCount,
                null, null, extraDetails);
    }

    void recordMasterAudit(HttpServletRequest request, String apiRoute, String masterType, int httpStatus,
            OrcaMasterService.LoadedFixture<?> fixture, boolean cacheHit, Boolean emptyResult, Integer resultCount,
            Boolean missingMasterOverride, Boolean fallbackUsedOverride, Map<String, Object> extraDetails) {
        if (sessionAuditDispatcher == null || fixture == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction("ORCA_MASTER_FETCH");
        payload.setResource(apiRoute);
        payload.setActorId(request != null ? request.getRemoteUser() : null);
        payload.setIpAddress(request != null ? request.getRemoteAddr() : null);
        payload.setUserAgent(request != null ? request.getHeader("User-Agent") : null);
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            payload.setTraceId(traceId);
        }
        String requestId = request != null ? request.getHeader("X-Request-Id") : null;
        if (requestId != null && !requestId.isBlank()) {
            payload.setRequestId(requestId);
        } else if (traceId != null && !traceId.isBlank()) {
            payload.setRequestId(traceId);
        }
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runId", resolveRunId(request));
        details.put("masterType", masterType);
        details.put("httpStatus", httpStatus);
        details.put("status", httpStatus >= 400 ? "failed" : "success");
        details.put("dataSource", dataSourceForOrigin(fixture.origin));
        details.put("snapshotVersion", fixture.snapshotVersion);
        details.put("version", firstNonBlank(fixture.version, OrcaMasterService.DEFAULT_VERSION));
        details.put("cacheHit", cacheHit);
        boolean missingMaster = fixture.origin == OrcaMasterService.DataOrigin.FALLBACK;
        if (missingMasterOverride != null) {
            missingMaster = missingMasterOverride;
        }
        boolean fallbackUsed = fixture.origin == OrcaMasterService.DataOrigin.FALLBACK;
        if (fallbackUsedOverride != null) {
            fallbackUsed = fallbackUsedOverride;
        } else if (missingMaster) {
            fallbackUsed = true;
        }
        details.put("missingMaster", missingMaster);
        details.put("fallbackUsed", fallbackUsed);
        if (traceId != null && !traceId.isBlank()) {
            details.put("traceId", traceId);
        }
        if (resultCount != null) {
            details.put("resultCount", resultCount);
            details.put("totalCount", resultCount);
        }
        if (emptyResult != null) {
            details.put("emptyResult", emptyResult);
        }
        if (extraDetails != null) {
            details.putAll(extraDetails);
        }
        payload.setDetails(details);
        AuditEventEnvelope.Outcome outcome = httpStatus >= 400
                ? AuditEventEnvelope.Outcome.FAILURE
                : AuditEventEnvelope.Outcome.SUCCESS;
        String errorCode = httpStatus >= 400 ? "http_" + httpStatus : null;
        sessionAuditDispatcher.record(payload, outcome, errorCode, null);
    }

    Map<String, Object> buildQueryDetails(String pref, String keyword, String effective,
            MultivaluedMap<String, String> params) {
        return buildQueryDetails(pref, keyword, effective, params, null);
    }

    Map<String, Object> buildQueryDetails(String pref, String keyword, String effective,
            MultivaluedMap<String, String> params, String zip) {
        Map<String, Object> details = new LinkedHashMap<>();
        if (pref != null) {
            details.put("queryPref", pref);
        }
        if (zip != null) {
            details.put("queryZip", zip);
        }
        if (keyword != null && !keyword.isBlank()) {
            details.put("keywordPresent", true);
            details.put("keywordLength", keyword.length());
        } else {
            details.put("keywordPresent", false);
        }
        if (effective != null) {
            details.put("effective", effective);
        }
        if (params != null) {
            String method = normalizeDrugSearchMethod(getFirstValue(params, "method"));
            if (method != null) {
                details.put("method", method);
            }
            if (shouldIncludeTotalCount(params)) {
                details.put("includeTotalCount", true);
            }
            details.put("page", parsePositiveInt(params, "page", 1));
            details.put("size", parsePageSize(params, "size", 100));
        }
        return details;
    }

    Map<String, Object> buildSrycdDetails(String srycd, String effective, MultivaluedMap<String, String> params) {
        Map<String, Object> details = buildQueryDetails(null, null, effective, params);
        details.put("srycd", srycd);
        return details;
    }

    Map<String, Object> buildTensuQueryDetails(String keyword, String category, String asOf, String tensuVersion,
            Double pointsMin, Double pointsMax, MultivaluedMap<String, String> params) {
        Map<String, Object> details = new LinkedHashMap<>();
        if (keyword != null && !keyword.isBlank()) {
            details.put("keywordPresent", true);
            details.put("keywordLength", keyword.length());
        } else {
            details.put("keywordPresent", false);
        }
        if (category != null) {
            details.put("category", category);
        }
        if (asOf != null) {
            details.put("asOf", asOf);
        }
        if (tensuVersion != null) {
            details.put("tensuVersion", tensuVersion);
        }
        if (pointsMin != null) {
            details.put("pointsMin", pointsMin);
        }
        if (pointsMax != null) {
            details.put("pointsMax", pointsMax);
        }
        if (params != null) {
            details.put("page", parsePositiveInt(params, "page", 1));
            details.put("size", parsePageSize(params, "size", 100));
            if (shouldIncludeTotalCount(params)) {
                details.put("includeTotalCount", true);
            }
        }
        return details;
    }

    Map<String, Object> buildEtensuAuditDetails(String keyword, String category, String asOf, String tensuVersion,
            Double pointsMin, Double pointsMax, MultivaluedMap<String, String> params,
            EtensuDao.EtensuSearchResult result) {
        Map<String, Object> details =
                buildTensuQueryDetails(keyword, category, asOf, tensuVersion, pointsMin, pointsMax, params);
        if (result != null) {
            details.put("loadFailed", result.isLoadFailed());
            details.put("rowCount", result.getRecords().size());
            details.put("dbTimeMs", result.getDbTimeMs());
        }
        return details;
    }

    private Response buildErrorResponse(Status status, String code, String message, HttpServletRequest request,
            Map<String, String> extraHeaders) {
        OrcaMasterErrorResponse response = new OrcaMasterErrorResponse();
        response.setCode(code);
        response.setError(code);
        response.setErrorCode(code);
        response.setMessage(message);
        response.setStatus(status != null ? status.getStatusCode() : null);
        response.setRunId(resolveRunId(request));
        response.setTimestamp(Instant.now().toString());
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            response.setCorrelationId(traceId);
            response.setTraceId(traceId);
        }
        response.setPath(request != null ? request.getRequestURI() : "/orca/master");
        if (status != null) {
            response.setErrorCategory(switch (status.getStatusCode()) {
                case 400, 422 -> "validation_error";
                case 401 -> "unauthorized";
                case 403 -> "forbidden";
                case 404 -> "not_found";
                default -> status.getStatusCode() >= 500 ? "server_error" : "client_error";
            });
        }
        Response.ResponseBuilder builder = Response.status(status).entity(response);
        if (extraHeaders != null) {
            for (Map.Entry<String, String> entry : extraHeaders.entrySet()) {
                if (entry.getKey() != null && !entry.getKey().isBlank() && entry.getValue() != null) {
                    builder.header(entry.getKey(), entry.getValue());
                }
            }
        }
        return builder.build();
    }

    private String resolveRunId(HttpServletRequest request) {
        return AbstractOrcaRestResource.resolveRunIdValue(request);
    }

    private String dataSourceForOrigin(OrcaMasterService.DataOrigin origin) {
        if (origin == OrcaMasterService.DataOrigin.FALLBACK) {
            return "fallback";
        }
        if (origin == OrcaMasterService.DataOrigin.ORCA_DB) {
            return "server";
        }
        return "snapshot";
    }

    private boolean shouldIncludeTotalCount(MultivaluedMap<String, String> params) {
        String raw = getFirstValue(params, "includeTotalCount");
        if (raw == null || raw.isBlank()) {
            return false;
        }
        String normalized = raw.trim().toLowerCase(Locale.ROOT);
        return "1".equals(normalized) || "true".equals(normalized) || "yes".equals(normalized);
    }

    private int parsePositiveInt(MultivaluedMap<String, String> params, String key, int fallback) {
        String raw = getFirstValue(params, key);
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            int parsed = Integer.parseInt(raw.trim());
            return parsed > 0 ? parsed : fallback;
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private int parsePageSize(MultivaluedMap<String, String> params, String key, int fallback) {
        return Math.min(parsePositiveInt(params, key, fallback), 2000);
    }

    private String getFirstValue(MultivaluedMap<String, String> params, String... keys) {
        if (params == null) {
            return null;
        }
        for (String key : keys) {
            List<String> values = params.get(key);
            if (values != null && !values.isEmpty()) {
                String value = values.get(0);
                if (value != null && !value.isBlank()) {
                    return value;
                }
            }
        }
        return null;
    }

    private String normalizeDrugSearchMethod(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "name", "kana", "code" -> normalized;
            default -> null;
        };
    }

    private String firstNonBlank(String... candidates) {
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

 package open.dolphin.rest;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.infomodel.DiagnosisSendWrapper;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.security.audit.AuditDetailSanitizer;
import open.dolphin.session.UserServiceBean;

/**
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
public class AbstractResource {

    protected static final String CAMMA = ",";
    protected static final boolean DEBUG = false;
    private static final DateTimeFormatter LEGACY_DATE_TIME_FORMATTER = new DateTimeFormatterBuilder()
            .parseLenient()
            .appendPattern("uuuu-MM-dd HH:mm:ss")
            .toFormatter(Locale.ROOT);
    private static final ObjectMapper SERIALIZE_MAPPER = createLegacyAwareMapper();
    private static final String TRACE_ID_HEADER = "X-Trace-Id";
    private static final String X_FORWARDED_FOR_HEADER = "X-Forwarded-For";
    private static final String X_REAL_IP_HEADER = "X-Real-Ip";
    private static final String TRUSTED_PROXY_PROP = "audit.trusted.proxies";
    private static final String TRUSTED_PROXY_ENV = "AUDIT_TRUSTED_PROXIES";
    public static final String ERROR_CODE_ATTRIBUTE = AbstractResource.class.getName() + ".ERROR_CODE";
    public static final String ERROR_MESSAGE_ATTRIBUTE = AbstractResource.class.getName() + ".ERROR_MESSAGE";
    public static final String ERROR_STATUS_ATTRIBUTE = AbstractResource.class.getName() + ".ERROR_STATUS";
    public static final String ERROR_DETAILS_ATTRIBUTE = AbstractResource.class.getName() + ".ERROR_DETAILS";

    protected Date parseDate(String source) {
        try {
            if (source == null || source.isBlank()) {
                return null;
            }
            LocalDateTime parsed = LocalDateTime.parse(source.trim(), LEGACY_DATE_TIME_FORMATTER);
            return Date.from(parsed.atZone(ZoneId.systemDefault()).toInstant());
        } catch (DateTimeException e) {
            Logger.getLogger(getClass().getName()).log(Level.WARNING, "Failed to parse date: " + source, e);
            return null;
        }
    }

    protected void debug(String msg) {
        Logger.getLogger("open.dolphin").fine(msg);
    }

    public static String getRemoteFacility(String remoteUser) {
        if (remoteUser == null) {
            return null;
        }
        int index = remoteUser.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (index < 0) {
            return remoteUser;
        }
        return remoteUser.substring(0, index);
    }

    public static String getFidPid(String remoteUser, String pid) {
        StringBuilder sb = new StringBuilder();
        sb.append(getRemoteFacility(remoteUser));
        sb.append(IInfoModel.COMPOSITE_KEY_MAKER);
        sb.append(pid);
        return sb.toString();
    }

    protected String requireRemoteUser(HttpServletRequest request) {
        String remoteUser = request != null ? request.getRemoteUser() : null;
        if (remoteUser == null || remoteUser.isBlank()) {
            throw restError(request, Response.Status.UNAUTHORIZED, "unauthorized", "Authentication required.");
        }
        if (!isCompositeRemoteUser(remoteUser)) {
            throw restError(request, Response.Status.UNAUTHORIZED, "unauthorized",
                    "Authenticated principal must include facility and user id.");
        }
        return remoteUser;
    }

    protected String requireActorFacility(HttpServletRequest request) {
        String actor = requireRemoteUser(request);
        String facilityId = getRemoteFacility(actor);
        if (facilityId == null || facilityId.isBlank()) {
            throw restError(request, Response.Status.UNAUTHORIZED, "facility_missing",
                    "Facility identifier is required for this operation.");
        }
        return facilityId;
    }

    protected String requireAdmin(HttpServletRequest request, UserServiceBean userServiceBean) {
        String actor = requireRemoteUser(request);
        if (userServiceBean == null || !userServiceBean.isAdmin(actor)) {
            throw restError(request, Response.Status.FORBIDDEN, "forbidden",
                    "Administrator privilege is required.");
        }
        return actor;
    }

    protected String resolveActorRole(HttpServletRequest request, UserServiceBean userServiceBean) {
        String actor = request != null ? request.getRemoteUser() : null;
        if (actor == null || actor.isBlank() || userServiceBean == null) {
            return null;
        }
        return userServiceBean.isAdmin(actor) ? "ADMIN" : null;
    }

    protected void ensureFacilityMatchOr404(String actorFacility, String targetFacility,
            String idName, Object idValue, HttpServletRequest request) {
        if (targetFacility == null || targetFacility.isBlank()
                || actorFacility == null || actorFacility.isBlank()
                || !actorFacility.equals(targetFacility)) {
            Map<String, Object> details = new LinkedHashMap<>();
            if (idName != null && !idName.isBlank() && idValue != null) {
                details.put(idName, idValue);
            }
            throw restError(request, Response.Status.NOT_FOUND, "not_found", "Requested resource was not found.",
                    details.isEmpty() ? null : details, null);
        }
    }

    // 2013/06/24    
    public static ObjectMapper getSerializeMapper() {
        return SERIALIZE_MAPPER;
    }

    protected <T> T readJson(String payload, Class<T> valueType) throws IOException {
        return getSerializeMapper().readValue(payload, valueType);
    }

    protected com.fasterxml.jackson.databind.JsonNode readJsonTree(String payload) throws JsonProcessingException {
        return getSerializeMapper().readTree(payload);
    }

    private static ObjectMapper createLegacyAwareMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        mapper.configure(SerializationFeature.WRITE_NULL_MAP_VALUES, false);
        mapper.disable(SerializationFeature.FAIL_ON_EMPTY_BEANS);
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        mapper.configure(DeserializationFeature.ACCEPT_EMPTY_STRING_AS_NULL_OBJECT, true);
        mapper.registerModule(new JavaTimeModule());
        mapper.configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false);
        return mapper;
    }

    protected String resolveTraceId(HttpServletRequest request) {
        return resolveTraceIdValue(request);
    }

    public static String resolveTraceIdValue(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        Object attribute = request.getAttribute(LogFilter.TRACE_ID_ATTRIBUTE);
        if (attribute instanceof String trace && !trace.isBlank()) {
            return trace;
        }
        String fromHeader = request.getHeader(TRACE_ID_HEADER);
        if (fromHeader != null && !fromHeader.isBlank()) {
            return fromHeader.trim();
        }
        return null;
    }

    public static String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }
        String remoteAddr = normalizeIpCandidate(request.getRemoteAddr());
        String forwardedFor = request.getHeader(X_FORWARDED_FOR_HEADER);
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            List<String> chain = parseForwardedFor(forwardedFor);
            if (!chain.isEmpty()) {
                if (!isTrustedProxy(remoteAddr)) {
                    return remoteAddr != null ? remoteAddr : chain.get(0);
                }
                String resolved = resolveClientFromForwardedChain(chain, remoteAddr);
                if (resolved != null) {
                    return resolved;
                }
            }
        }
        String realIp = normalizeIpCandidate(request.getHeader(X_REAL_IP_HEADER));
        if (realIp != null && isTrustedProxy(remoteAddr)) {
            return realIp;
        }
        return remoteAddr != null ? remoteAddr : "unknown";
    }

    private static String resolveClientFromForwardedChain(List<String> forwardedChain, String remoteAddr) {
        List<String> chain = new ArrayList<>(forwardedChain);
        if (remoteAddr != null) {
            chain.add(remoteAddr);
        }
        for (int i = chain.size() - 1; i >= 0; i--) {
            String candidate = chain.get(i);
            if (!isTrustedProxy(candidate)) {
                return candidate;
            }
        }
        return chain.isEmpty() ? null : chain.get(0);
    }

    private static List<String> parseForwardedFor(String headerValue) {
        if (headerValue == null || headerValue.isBlank()) {
            return Collections.emptyList();
        }
        List<String> parsed = new ArrayList<>();
        for (String candidate : headerValue.split(",")) {
            String normalized = normalizeIpCandidate(candidate);
            if (normalized != null) {
                parsed.add(normalized);
            }
        }
        return parsed;
    }

    private static boolean isTrustedProxy(String candidate) {
        InetAddress address = parseAddress(candidate);
        if (address == null) {
            return false;
        }
        if (address.isLoopbackAddress()) {
            return true;
        }
        for (String rule : loadTrustedProxyRules()) {
            if (matchesTrustedRule(address, rule)) {
                return true;
            }
        }
        return false;
    }

    private static Set<String> loadTrustedProxyRules() {
        String fromProperty = System.getProperty(TRUSTED_PROXY_PROP);
        String fromEnv = System.getenv(TRUSTED_PROXY_ENV);
        String raw = firstNonBlank(fromProperty, fromEnv);
        if (raw == null) {
            return Collections.emptySet();
        }
        Set<String> rules = new LinkedHashSet<>();
        Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(token -> !token.isEmpty())
                .forEach(rules::add);
        return rules;
    }

    private static boolean matchesTrustedRule(InetAddress candidate, String rule) {
        if (candidate == null || rule == null || rule.isBlank()) {
            return false;
        }
        if (!rule.contains("/")) {
            InetAddress exact = parseAddress(rule);
            return exact != null && Arrays.equals(candidate.getAddress(), exact.getAddress());
        }
        String[] parts = rule.split("/", 2);
        if (parts.length != 2) {
            return false;
        }
        InetAddress networkAddress = parseAddress(parts[0]);
        if (networkAddress == null) {
            return false;
        }
        int prefix;
        try {
            prefix = Integer.parseInt(parts[1].trim());
        } catch (NumberFormatException ex) {
            return false;
        }
        byte[] candidateBytes = candidate.getAddress();
        byte[] networkBytes = networkAddress.getAddress();
        if (candidateBytes.length != networkBytes.length) {
            return false;
        }
        int maxPrefix = candidateBytes.length * 8;
        if (prefix < 0 || prefix > maxPrefix) {
            return false;
        }
        int fullBytes = prefix / 8;
        int remainderBits = prefix % 8;
        for (int i = 0; i < fullBytes; i++) {
            if (candidateBytes[i] != networkBytes[i]) {
                return false;
            }
        }
        if (remainderBits == 0) {
            return true;
        }
        int mask = 0xFF << (8 - remainderBits);
        return (candidateBytes[fullBytes] & mask) == (networkBytes[fullBytes] & mask);
    }

    private static InetAddress parseAddress(String value) {
        String normalized = normalizeIpCandidate(value);
        if (normalized == null) {
            return null;
        }
        try {
            return InetAddress.getByName(normalized);
        } catch (UnknownHostException ex) {
            return null;
        }
    }

    private static String normalizeIpCandidate(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty() || "unknown".equalsIgnoreCase(trimmed)) {
            return null;
        }
        if (trimmed.startsWith("[") && trimmed.contains("]")) {
            return trimmed.substring(1, trimmed.indexOf(']'));
        }
        int colonCount = 0;
        for (int i = 0; i < trimmed.length(); i++) {
            if (trimmed.charAt(i) == ':') {
                colonCount++;
            }
        }
        if (colonCount == 1 && trimmed.contains(".")) {
            int idx = trimmed.indexOf(':');
            return idx > 0 ? trimmed.substring(0, idx) : trimmed;
        }
        return trimmed;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static boolean isCompositeRemoteUser(String remoteUser) {
        return remoteUser != null && remoteUser.contains(IInfoModel.COMPOSITE_KEY_MAKER);
    }

    public static WebApplicationException restError(HttpServletRequest request, Response.Status status,
            String errorCode, String message) {
        return restError(request, status, errorCode, message, null, null);
    }

    public static WebApplicationException restError(HttpServletRequest request, Response.Status status,
            String errorCode, String message, Map<String, ?> details, Throwable cause) {
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(errorCode, "errorCode");
        markErrorAttributes(request, status.getStatusCode(), errorCode, message, details);
        Map<String, Object> body = buildErrorBody(request, status.getStatusCode(), errorCode, message, details);
        Response response = Response.status(status)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(body)
                .build();
        return cause == null ? new WebApplicationException(message, response)
                : new WebApplicationException(message, cause, response);
    }

    public static void writeRestError(HttpServletRequest request, HttpServletResponse response, int status,
            String errorCode, String message, Map<String, ?> details) throws IOException {
        if (response == null) {
            return;
        }
        markErrorAttributes(request, status, errorCode, message, details);
        if (!response.isCommitted()) {
            response.resetBuffer();
        }
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON);
        response.setCharacterEncoding("UTF-8");
        Map<String, Object> body = buildErrorBody(request, status, errorCode, message, details);
        getSerializeMapper().writeValue(response.getOutputStream(), body);
    }

    protected void populateDiagnosisAuditMetadata(HttpServletRequest request,
            DiagnosisSendWrapper wrapper,
            String resourcePath) {
        if (wrapper == null) {
            return;
        }
        if (request != null) {
            wrapper.setRemoteUser(request.getRemoteUser());
            String traceId = resolveTraceId(request);
            if (traceId != null && !traceId.isBlank()) {
                wrapper.setTraceId(traceId);
            }
            String requestIdHeader = request.getHeader("X-Request-Id");
            if (requestIdHeader != null && !requestIdHeader.isBlank()) {
                wrapper.setRequestId(requestIdHeader.trim());
            }
            if (resourcePath == null || resourcePath.isBlank()) {
                wrapper.setAuditResource(request.getRequestURI());
            }
        }
        if (resourcePath != null && !resourcePath.isBlank()) {
            wrapper.setAuditResource(resourcePath);
        }
        if (wrapper.getTraceId() == null || wrapper.getTraceId().isBlank()) {
            String fallback = resolveTraceId(request);
            if (fallback != null && !fallback.isBlank()) {
                wrapper.setTraceId(fallback);
            }
        }
        if (wrapper.getRequestId() == null || wrapper.getRequestId().isBlank()) {
            String fallback = wrapper.getTraceId();
            if (fallback == null || fallback.isBlank()) {
                fallback = UUID.randomUUID().toString();
            }
            wrapper.setRequestId(fallback);
        }
    }

    private static Map<String, Object> buildErrorBody(HttpServletRequest request, int status, String errorCode,
            String message, Map<String, ?> details) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", errorCode);
        body.put("code", errorCode);
        body.put("errorCode", errorCode);
        if (message != null && !message.isBlank()) {
            body.put("message", message);
        }
        body.put("status", status);
        body.put("errorCategory", classifyErrorCategory(status));
        String traceId = resolveTraceIdValue(request);
        if (traceId != null && !traceId.isBlank()) {
            body.put("traceId", traceId);
        }
        String requestId = resolveRequestIdValue(request, traceId);
        if (requestId != null && !requestId.isBlank()) {
            body.put("requestId", requestId);
        }
        String runId = resolveRunIdValue(request);
        if (runId != null && !runId.isBlank()) {
            body.put("runId", runId);
        }
        if (request != null) {
            String path = request.getRequestURI();
            if (path != null && !path.isBlank()) {
                body.put("path", path);
            }
        }
        if (details != null) {
            Map<String, Object> detailMap = new LinkedHashMap<>();
            details.forEach((key, value) -> {
                if (key == null || value == null) {
                    return;
                }
                String k = key.toString();
                if (k.isBlank()) {
                    return;
                }
                // Avoid awkward nesting when callers already pass a "details" map.
                // Our response always provides a top-level "details" object, so merge its entries.
                if ("details".equals(k) && value instanceof Map<?, ?> nested) {
                    for (Map.Entry<?, ?> entry : nested.entrySet()) {
                        if (entry.getKey() == null || entry.getValue() == null) {
                            continue;
                        }
                        String nk = entry.getKey().toString();
                        if (nk.isBlank()) {
                            continue;
                        }
                        detailMap.put(nk, entry.getValue());
                        body.putIfAbsent(nk, entry.getValue());
                    }
                    return;
                }
                detailMap.put(k, value);
                // Keep backward compatibility: also merge into top-level, but never override core fields.
                body.putIfAbsent(k, value);
            });
            if (!detailMap.isEmpty()) {
                body.put("details", detailMap);
            }
        }
        if (!body.containsKey("validationError") && (status == 400 || status == 422)) {
            body.put("validationError", Boolean.TRUE);
        }
        body.put("timestamp", Instant.now().toString());
        return body;
    }

    private static String resolveRequestIdValue(HttpServletRequest request, String traceId) {
        if (request != null) {
            Object attribute = request.getAttribute(LogFilter.REQUEST_ID_ATTRIBUTE);
            if (attribute instanceof String requestId && !requestId.isBlank()) {
                return requestId;
            }
            String fromHeader = request.getHeader("X-Request-Id");
            if (fromHeader != null && !fromHeader.isBlank()) {
                return fromHeader.trim();
            }
        }
        return traceId;
    }

    private static String resolveRunIdValue(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        Object attribute = request.getAttribute(LogFilter.RUN_ID_ATTRIBUTE);
        if (attribute instanceof String runId && !runId.isBlank()) {
            return runId;
        }
        String fromHeader = request.getHeader("X-Run-Id");
        if (fromHeader != null && !fromHeader.isBlank()) {
            return fromHeader.trim();
        }
        return null;
    }

    private static String classifyErrorCategory(int status) {
        return switch (status) {
            case 400, 422 -> "validation_error";
            case 401 -> "unauthorized";
            case 403 -> "forbidden";
            case 404 -> "not_found";
            case 409 -> "conflict";
            case 413 -> "payload_too_large";
            case 415 -> "unsupported_media_type";
            default -> status >= 500 ? "server_error" : "client_error";
        };
    }

    private static void markErrorAttributes(HttpServletRequest request, int status, String errorCode, String message,
            Map<String, ?> details) {
        if (request == null) {
            return;
        }
        request.setAttribute(ERROR_STATUS_ATTRIBUTE, status);
        if (errorCode != null && !errorCode.isBlank()) {
            request.setAttribute(ERROR_CODE_ATTRIBUTE, errorCode);
        }
        if (message != null && !message.isBlank()) {
            request.setAttribute(ERROR_MESSAGE_ATTRIBUTE, message);
        }
        Map<String, Object> filtered = filterErrorDetails(details);
        if ((status == 400 || status == 422) && !filtered.containsKey("validationError")) {
            filtered.put("validationError", Boolean.TRUE);
        }
        if (!filtered.isEmpty()) {
            request.setAttribute(ERROR_DETAILS_ATTRIBUTE, filtered);
        }
    }

    private static Map<String, Object> filterErrorDetails(Map<String, ?> details) {
        Map<String, Object> filtered = new LinkedHashMap<>();
        if (details == null) {
            return filtered;
        }
        details.forEach((key, value) -> {
            if (key == null || value == null) {
                return;
            }
            String normalizedKey = key.toString();
            if (normalizedKey.isBlank()) {
                return;
            }
            filtered.put(normalizedKey, value);
        });
        Map<String, Object> sanitized = AuditDetailSanitizer.sanitizeDetails("REST_ERROR_RESPONSE", filtered);
        return sanitized != null ? sanitized : filtered;
    }
}

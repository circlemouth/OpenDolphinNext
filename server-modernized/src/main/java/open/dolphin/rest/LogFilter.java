package open.dolphin.rest;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Pattern;
import jakarta.inject.Inject;
import jakarta.servlet.*;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.security.audit.AuditDetailSanitizer;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.framework.SessionTraceAttributes;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import org.jboss.logmanager.MDC;

/**
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
@WebFilter(urlPatterns = "/api/*", asyncSupported = true)
public class LogFilter implements Filter {

    private static final Logger SECURITY_LOGGER = Logger.getLogger(LogFilter.class.getName());
    private static final String UNAUTHORIZED_USER = "Unauthorized user: ";
    private static final String TRACE_ID_HEADER = "X-Trace-Id";
    private static final String REQUEST_ID_HEADER = "X-Request-Id";
    private static final String RUN_ID_HEADER = "X-Run-Id";
    public static final String FEATURE_CLIENT_HEADER = "X-Client-Feature-Images";
    public static final String LEGACY_FEATURE_CLIENT_HEADER = "X-Feature-Images";
    public static final String TRACE_ID_ATTRIBUTE = LogFilter.class.getName() + ".TRACE_ID";
    public static final String REQUEST_ID_ATTRIBUTE = LogFilter.class.getName() + ".REQUEST_ID";
    public static final String RUN_ID_ATTRIBUTE = LogFilter.class.getName() + ".RUN_ID";
    private static final String MDC_TRACE_ID_KEY = "traceId";
    private static final String MDC_REQUEST_ID_KEY = "requestId";
    private static final String MDC_RUN_ID_KEY = "runId";
    private static final String MDC_USER_ID_KEY = "userId";
    private static final String MDC_FACILITY_ID_KEY = "facilityId";
    private static final String ANONYMOUS_PRINCIPAL = "anonymous";
    private static final String ERROR_AUDIT_RECORDED_ATTR = LogFilter.class.getName() + ".ERROR_AUDIT_RECORDED";
    private static final String PRINCIPAL_FACILITY_DETAILS_KEY = "facilityId";
    private static final String SESSION_LOGIN_PATH = "/api/session/login";
    private static final String SESSION_FACTOR2_LOGIN_PATH = "/api/session/login/factor2";
    private static final String LOGOUT_PATH = "/api/logout";
    private static final String HEALTH_PATH = "/api/health";
    private static final String HEALTH_READINESS_PATH = "/api/health/readiness";
    private static final String OPERATIONS_READINESS_PATH = "/api/operations/readiness";
    private static final String API_ROOT = "/api";
    private static final Pattern SAFE_TOKEN = Pattern.compile("^[A-Za-z0-9._-]{1,64}$");

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        // no-op
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest)request;
        HttpServletResponse res = (HttpServletResponse) response;
        long startedNanos = System.nanoTime();
        String traceId = resolveTraceId(req);
        String requestId = resolveRequestId(req, traceId);
        String runId = resolveRunId(req);
        applyTraceContext(req, res, traceId, requestId, runId);
        MdcSnapshot traceIdSnapshot = applyMdcValue(MDC_TRACE_ID_KEY, traceId);
        MdcSnapshot requestIdSnapshot = applyMdcValue(MDC_REQUEST_ID_KEY, requestId);
        MdcSnapshot runIdSnapshot = applyMdcValue(MDC_RUN_ID_KEY, runId);
        MdcSnapshot remoteUserSnapshot = null;
        MdcSnapshot userIdSnapshot = null;
        MdcSnapshot facilityIdSnapshot = null;
        try {
            if (isAnonymousAllowed(req)) {
                handleAnonymousRequest(req, res, chain, startedNanos, traceId, requestId, runId);
                return;
            }
            BlockWrapper wrapper = requireAuthenticatedWrapper(req, res, traceId, requestId, runId);
            if (wrapper == null) {
                return;
            }
            String resolvedUser = wrapper.getRemoteUser();
            remoteUserSnapshot = applyMdcValue(SessionTraceAttributes.ACTOR_ID_MDC_KEY, resolvedUser);
            String facilityId = extractFacilitySegment(resolvedUser);
            String userId = extractUserSegment(resolvedUser);
            facilityIdSnapshot = applyMdcValue(MDC_FACILITY_ID_KEY, facilityId);
            userIdSnapshot = applyMdcValue(MDC_USER_ID_KEY, userId);
            handleAuthenticatedRequest(wrapper, res, chain, startedNanos, traceId, requestId, runId, userId, facilityId);
        } catch (IOException | ServletException ex) {
            maybeRecordErrorAudit(req, res, ex);
            throw ex;
        } catch (RuntimeException ex) {
            maybeRecordErrorAudit(req, res, ex);
            throw ex;
        } finally {
            restoreMdcValue(traceIdSnapshot);
            restoreMdcValue(requestIdSnapshot);
            restoreMdcValue(runIdSnapshot);
            restoreMdcValue(remoteUserSnapshot);
            restoreMdcValue(userIdSnapshot);
            restoreMdcValue(facilityIdSnapshot);
        }
    }

    private void applyTraceContext(
            HttpServletRequest request,
            HttpServletResponse response,
            String traceId,
            String requestId,
            String runId) {
        request.setAttribute(TRACE_ID_ATTRIBUTE, traceId);
        request.setAttribute(REQUEST_ID_ATTRIBUTE, requestId);
        if (runId != null && !runId.isBlank()) {
            request.setAttribute(RUN_ID_ATTRIBUTE, runId);
        }
        response.setHeader(TRACE_ID_HEADER, traceId);
        response.setHeader(REQUEST_ID_HEADER, requestId);
        if (runId != null && !runId.isBlank()) {
            response.setHeader(RUN_ID_HEADER, runId);
        }
    }

    private void handleAnonymousRequest(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain,
            long startedNanos,
            String traceId,
            String requestId,
            String runId) throws IOException, ServletException {
        BlockWrapper wrapper = wrapForAnonymous(request, traceId, requestId, runId);
        chain.doFilter(wrapper, response);
        logAccessResponse(response, wrapper, traceId, requestId, runId, startedNanos, null, null);
        maybeRecordErrorAudit(wrapper, response, null);
    }

    private BlockWrapper requireAuthenticatedWrapper(
            HttpServletRequest request,
            HttpServletResponse response,
            String traceId,
            String requestId,
            String runId) throws IOException {
        Optional<String> principalUser = resolveSessionUser(request);
        if (principalUser.isEmpty()) {
            handleUnauthorizedRequest(request, response, traceId, null,
                    "Authentication required", "authentication_failed");
            return null;
        }

        String resolvedUser = normalize(principalUser.orElse(null));
        if (!isCompositePrincipal(resolvedUser)) {
            handleUnauthorizedRequest(request, response, traceId, resolvedUser,
                    "Authenticated principal must be composite", "principal_not_composite");
            return null;
        }

        BlockWrapper wrapper = new BlockWrapper(request);
        wrapper.setRemoteUser(resolvedUser);
        wrapper.setHeader(TRACE_ID_HEADER, traceId);
        wrapper.setHeader(REQUEST_ID_HEADER, requestId);
        wrapper.setHeader(RUN_ID_HEADER, runId);
        return wrapper;
    }

    private void handleAuthenticatedRequest(
            BlockWrapper wrapper,
            HttpServletResponse response,
            FilterChain chain,
            long startedNanos,
            String traceId,
            String requestId,
            String runId,
            String userId,
            String facilityId) throws IOException, ServletException {
        chain.doFilter(wrapper, response);
        logAccessResponse(response, wrapper, traceId, requestId, runId, startedNanos, userId, facilityId);
        maybeRecordErrorAudit(wrapper, response, null);
    }

    private void handleUnauthorizedRequest(
            HttpServletRequest request,
            HttpServletResponse response,
            String traceId,
            String candidateUser,
            String message,
            String detailCode) throws IOException {
        logUnauthorized(request, candidateUser, traceId);
        recordUnauthorizedAudit(request, traceId, candidateUser, "unauthorized",
                message, detailCode, HttpServletResponse.SC_UNAUTHORIZED);
        sendUnauthorized(request, response, "unauthorized", message, unauthorizedDetails(detailCode));
    }

    private boolean isAnonymousAllowed(HttpServletRequest request) {
        String normalizedPath = normalizeRequestPath(request);
        if (normalizedPath == null) {
            return false;
        }
        return SESSION_LOGIN_PATH.equals(normalizedPath)
                || SESSION_FACTOR2_LOGIN_PATH.equals(normalizedPath)
                || LOGOUT_PATH.equals(normalizedPath)
                || HEALTH_PATH.equals(normalizedPath)
                || HEALTH_READINESS_PATH.equals(normalizedPath);
    }

    private String normalizeRequestPath(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String uri = request.getRequestURI();
        if (uri == null || uri.isBlank()) {
            return null;
        }
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isBlank() && uri.startsWith(contextPath)) {
            String stripped = uri.substring(contextPath.length());
            return stripped.isEmpty() ? "/" : stripped;
        }
        return uri;
    }

    private BlockWrapper wrapForAnonymous(HttpServletRequest request, String traceId, String requestId, String runId) {
        BlockWrapper wrapper = new BlockWrapper(request);
        wrapper.setHeader(TRACE_ID_HEADER, traceId);
        wrapper.setHeader(REQUEST_ID_HEADER, requestId);
        wrapper.setHeader(RUN_ID_HEADER, runId);
        return wrapper;
    }

    private Optional<String> resolveSessionUser(HttpServletRequest request) {
        if (request == null) {
            return Optional.empty();
        }
        try {
            HttpSession session = request.getSession(false);
            String actorId = normalize(AuthSessionSupport.resolveActorId(session));
            return actorId == null ? Optional.empty() : Optional.of(actorId);
        } catch (IllegalStateException ex) {
            SECURITY_LOGGER.log(Level.FINE, "Session unavailable while resolving actor", ex);
            return Optional.empty();
        }
    }

    @Override
    public void destroy() {
    }

    private String resolveTraceId(HttpServletRequest req) {
        String traceHeader = safeHeader(req, TRACE_ID_HEADER);
        String normalizedTrace = normalizeToken(traceHeader);
        if (normalizedTrace != null) {
            return normalizedTrace;
        }
        if (normalize(traceHeader) != null) {
            return UUID.randomUUID().toString();
        }

        String requestHeader = safeHeader(req, REQUEST_ID_HEADER);
        String normalizedRequest = normalizeToken(requestHeader);
        if (normalizedRequest != null) {
            return normalizedRequest;
        }
        if (normalize(requestHeader) != null) {
            return UUID.randomUUID().toString();
        }
        return UUID.randomUUID().toString();
    }

    private String resolveRequestId(HttpServletRequest req, String traceId) {
        String requestHeader = safeHeader(req, REQUEST_ID_HEADER);
        String normalizedRequest = normalizeToken(requestHeader);
        if (normalizedRequest != null) {
            return normalizedRequest;
        }
        if (normalize(requestHeader) != null) {
            return UUID.randomUUID().toString();
        }

        String normalizedTrace = normalizeToken(traceId);
        return normalizedTrace != null ? normalizedTrace : UUID.randomUUID().toString();
    }

    private String resolveRunId(HttpServletRequest req) {
        if (!isOrcaRequest(req)) {
            return null;
        }
        String normalizedRunId = normalizeToken(AbstractOrcaRestResource.resolveRunIdValue(req));
        if (normalizedRunId != null) {
            return normalizedRunId;
        }
        String generatedRunId = normalizeToken(AbstractOrcaRestResource.resolveRunIdValue((String) null));
        return generatedRunId != null ? generatedRunId : UUID.randomUUID().toString();
    }

    private String normalizeToken(String candidate) {
        String normalized = normalize(candidate);
        if (normalized == null) {
            return null;
        }
        return SAFE_TOKEN.matcher(normalized).matches() ? normalized : null;
    }

    private boolean isOrcaRequest(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        String uri = request.getRequestURI();
        if (uri == null || uri.isBlank()) {
            return false;
        }
        return uri.contains("/api/orca/") || uri.endsWith("/api/orca");
    }

    private void logAccessResponse(HttpServletResponse response, BlockWrapper request, String traceId,
            String requestId, String runId, long startedNanos, String userId, String facilityId) {
        if (response == null || request == null) {
            return;
        }
        int status = response.getStatus();
        long elapsedMs = TimeUnit.NANOSECONDS.toMillis(Math.max(0L, System.nanoTime() - startedNanos));
        String uri = request.getRequestURIForLog();
        Logger logger = uri != null && uri.startsWith("/jtouch") ? Logger.getLogger("visit.touch") : Logger.getLogger("open.dolphin");
        String record = String.format(
                "access method=%s uri=%s status=%d elapsedMs=%d traceId=%s requestId=%s runId=%s userId=%s facilityId=%s remoteAddr=%s",
                safe(request.getMethod()),
                safe(uri),
                status,
                elapsedMs,
                safe(traceId),
                safe(requestId),
                safe(runId),
                safe(userId),
                safe(facilityId),
                safe(request.getRemoteAddr()));
        if (status >= 400) {
            logger.warning(record);
        } else {
            logger.info(record);
        }
    }

    private static String safe(String value) {
        if (value == null || value.isBlank()) {
            return "-";
        }
        return value.trim();
    }

    private MdcSnapshot applyMdcValue(String key, String value) {
        Object previousJboss = MDC.get(key);
        String previousSlf4j = org.slf4j.MDC.get(key);
        if (value == null || value.isBlank()) {
            MDC.remove(key);
            org.slf4j.MDC.remove(key);
        } else {
            MDC.put(key, value);
            org.slf4j.MDC.put(key, value);
        }
        return new MdcSnapshot(key, previousJboss, previousSlf4j);
    }

    private void restoreMdcValue(MdcSnapshot snapshot) {
        if (snapshot == null) {
            return;
        }
        if (snapshot.previousJboss == null) {
            MDC.remove(snapshot.key);
        } else {
            MDC.put(snapshot.key, snapshot.previousJboss.toString());
        }
        if (snapshot.previousSlf4j == null) {
            org.slf4j.MDC.remove(snapshot.key);
        } else {
            org.slf4j.MDC.put(snapshot.key, snapshot.previousSlf4j);
        }
    }

    private static final class MdcSnapshot {
        private final String key;
        private final Object previousJboss;
        private final String previousSlf4j;

        private MdcSnapshot(String key, Object previousJboss, String previousSlf4j) {
            this.key = key;
            this.previousJboss = previousJboss;
            this.previousSlf4j = previousSlf4j;
        }
    }

    private void logUnauthorized(HttpServletRequest req, String user, String traceId) {
        StringBuilder sbd = new StringBuilder(UNAUTHORIZED_USER);
        sbd.append(user != null ? user : "unknown");
        sbd.append(": ").append(req.getRequestURI());
        if (traceId != null && !traceId.isBlank()) {
            sbd.append(" traceId=").append(traceId);
        }
        Logger.getLogger("open.dolphin").warning(sbd.toString());
    }

    private void sendUnauthorized(HttpServletRequest request, HttpServletResponse response, String errorCode,
            String message, Map<String, Object> details) throws IOException {
        AbstractResource.writeRestError(request, response, HttpServletResponse.SC_UNAUTHORIZED, errorCode, message, details);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String safeHeader(HttpServletRequest req, String headerName) {
        String value = req.getHeader(headerName);
        if (value == null) {
            return null;
        }
        return value.trim();
    }

    private boolean isCompositePrincipal(String candidate) {
        if (candidate == null) {
            return false;
        }
        return candidate.contains(IInfoModel.COMPOSITE_KEY_MAKER);
    }

    private String extractFacilitySegment(String candidate) {
        if (candidate == null) {
            return null;
        }
        int separator = candidate.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (separator > 0) {
            return candidate.substring(0, separator);
        }
        return null;
    }

    private String extractUserSegment(String candidate) {
        if (candidate == null) {
            return null;
        }
        int separator = candidate.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (separator >= 0 && separator + 1 < candidate.length()) {
            return candidate.substring(separator + 1);
        }
        return candidate;
    }

    private Map<String, Object> unauthorizedDetails(String reason) {
        Map<String, Object> details = new HashMap<>();
        details.put("reason", reason);
        return details;
    }

    private void recordUnauthorizedAudit(HttpServletRequest request,
            String traceId,
            String principal,
            String errorCode,
            String errorMessage,
            String reason,
            int statusCode) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction("REST_UNAUTHORIZED_GUARD");
        payload.setResource(request != null ? request.getRequestURI() : API_ROOT);
        String actorId = principal == null || principal.isBlank() ? "anonymous" : principal;
        payload.setActorId(actorId);
        payload.setActorDisplayName(principal);
        payload.setActorRole("SYSTEM");
        payload.setIpAddress(AbstractResource.resolveClientIp(request));
        payload.setUserAgent(request != null ? request.getHeader("User-Agent") : null);
        String effectiveTrace = (traceId == null || traceId.isBlank()) ? UUID.randomUUID().toString() : traceId;
        payload.setRequestId(effectiveTrace);
        payload.setTraceId(effectiveTrace);
        Map<String, Object> details = new HashMap<>();
        details.put("status", "failed");
        details.put("reason", reason);
        if (errorCode != null && !errorCode.isBlank()) {
            details.put("errorCode", errorCode);
            details.putIfAbsent("reason", errorCode);
        }
        if (errorMessage != null && !errorMessage.isBlank()) {
            details.put("errorMessage", errorMessage);
        }
        details.put("httpStatus", statusCode);
        String facilityFromPrincipal = extractFacilitySegment(principal);
        if (facilityFromPrincipal != null) {
            details.put(PRINCIPAL_FACILITY_DETAILS_KEY, facilityFromPrincipal);
        }
        if (principal != null && !principal.isBlank()) {
            details.put("principal", principal);
        }
        Map<String, Object> sanitizedDetails = AuditDetailSanitizer.sanitizeDetails(payload.getAction(), details);
        payload.setPatientId(AuditDetailSanitizer.resolvePatientId(null, sanitizedDetails));
        payload.setDetails(sanitizedDetails);
        sessionAuditDispatcher.record(payload, AuditEventEnvelope.Outcome.FAILURE,
                errorCode != null && !errorCode.isBlank() ? errorCode : reason, errorMessage);
        if (request != null) {
            request.setAttribute(ERROR_AUDIT_RECORDED_ATTR, Boolean.TRUE);
        }
    }

    private void maybeRecordErrorAudit(HttpServletRequest request, HttpServletResponse response, Throwable failure) {
        if (sessionAuditDispatcher == null || request == null) {
            return;
        }
        if (Boolean.TRUE.equals(request.getAttribute(ERROR_AUDIT_RECORDED_ATTR))) {
            return;
        }
        int status = resolveErrorStatus(response);
        // If an exception occurred but the response status is still success (e.g. 200),
        // treat it as an Internal Server Error (500) to ensure it gets audited.
        if (failure != null && status < HttpServletResponse.SC_BAD_REQUEST) {
            status = HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
        }

        if (status < HttpServletResponse.SC_BAD_REQUEST) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        String resource = request.getRequestURI();
        payload.setAction("REST_ERROR_RESPONSE");
        payload.setResource(resource != null ? resource : API_ROOT);
        String actorId = request.getRemoteUser();
        if (actorId == null || actorId.isBlank()) {
            actorId = ANONYMOUS_PRINCIPAL;
        }
        payload.setActorId(actorId);
        payload.setActorDisplayName(actorId);
        payload.setActorRole("SYSTEM");
        payload.setIpAddress(AbstractResource.resolveClientIp(request));
        payload.setUserAgent(request.getHeader("User-Agent"));
        String traceId = resolveTraceId(request);
        if (traceId == null || traceId.isBlank()) {
            traceId = UUID.randomUUID().toString();
        }
        payload.setRequestId(traceId);
        payload.setTraceId(traceId);
        Map<String, Object> details = new HashMap<>();
        details.put("status", "failed");
        details.put("httpStatus", status);
        String errorCode = resolveErrorCode(request, status);
        String errorMessage = resolveErrorMessage(request, failure);
        mergeErrorDetails(details, request);
        if (errorCode != null && !errorCode.isBlank()) {
            details.put("errorCode", errorCode);
            details.putIfAbsent("reason", errorCode);
        }
        if (errorMessage != null && !errorMessage.isBlank()) {
            details.put("errorMessage", errorMessage);
        }
        if (!details.containsKey("validationError") && (status == 400 || status == 422)) {
            details.put("validationError", Boolean.TRUE);
        }
        String facilityFromPrincipal = extractFacilitySegment(request != null ? request.getRemoteUser() : null);
        if (facilityFromPrincipal != null) {
            details.put(PRINCIPAL_FACILITY_DETAILS_KEY, facilityFromPrincipal);
        }
        if (failure != null) {
            details.put("exception", failure.getClass().getName());
            if (failure.getMessage() != null && !failure.getMessage().isBlank()) {
                details.put("exceptionMessage", failure.getMessage());
            }
        }
        Map<String, Object> sanitizedDetails = AuditDetailSanitizer.sanitizeDetails(payload.getAction(), details);
        payload.setPatientId(AuditDetailSanitizer.resolvePatientId(null, sanitizedDetails));
        payload.setDetails(sanitizedDetails);
        sessionAuditDispatcher.record(payload, AuditEventEnvelope.Outcome.FAILURE, errorCode, errorMessage);
        request.setAttribute(ERROR_AUDIT_RECORDED_ATTR, Boolean.TRUE);
    }

    private int resolveErrorStatus(HttpServletResponse response) {
        if (response != null && response.getStatus() > 0) {
            return response.getStatus();
        }
        return HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
    }

    private String resolveErrorCode(HttpServletRequest request, int status) {
        if (request != null) {
            Object attribute = request.getAttribute(AbstractResource.ERROR_CODE_ATTRIBUTE);
            if (attribute instanceof String code && !code.isBlank()) {
                return code;
            }
        }
        return "http_" + status;
    }

    private String resolveErrorMessage(HttpServletRequest request, Throwable failure) {
        if (request != null) {
            Object attribute = request.getAttribute(AbstractResource.ERROR_MESSAGE_ATTRIBUTE);
            if (attribute instanceof String message && !message.isBlank()) {
                return message;
            }
        }
        if (failure != null && failure.getMessage() != null && !failure.getMessage().isBlank()) {
            return failure.getMessage();
        }
        return null;
    }

    private void mergeErrorDetails(Map<String, Object> target, HttpServletRequest request) {
        if (target == null || request == null) {
            return;
        }
        Object attribute = request.getAttribute(AbstractResource.ERROR_DETAILS_ATTRIBUTE);
        if (!(attribute instanceof Map<?, ?> details)) {
            return;
        }
        details.forEach((key, value) -> {
            if (key == null || value == null) {
                return;
            }
            String normalizedKey = key.toString();
            if (normalizedKey.isBlank()) {
                return;
            }
            target.putIfAbsent(normalizedKey, value);
        });
    }
}

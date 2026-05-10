package open.dolphin.orca.transport;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Tags;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.LockSupport;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.model.OrcaApiResult;
import open.dolphin.rest.OrcaApiProxySupport;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;

/**
 * Shared HTTP client for ORCA API calls.
 */
public class OrcaHttpClient {

    private static final Logger LOGGER = Logger.getLogger(OrcaHttpClient.class.getName());

    private static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration DEFAULT_READ_TIMEOUT = Duration.ofSeconds(15);
    private static final Duration DEFAULT_TOTAL_DEADLINE = Duration.ofSeconds(30);
    private static final String ORCA_CONTENT_TYPE = "application/xml; charset=UTF-8";
    private static final String ORCA_JSON_CONTENT_TYPE = "application/json; charset=UTF-8";
    private static final String ORCA_ACCEPT_XML = "application/xml";
    private static final String ORCA_EXTERNAL_REQUEST_COUNTER = "opendolphin_orca_external_request_total";
    private static final String ORCA_EXTERNAL_ERROR_COUNTER = "opendolphin_orca_external_error_total";
    private static final String ORCA_EXTERNAL_LATENCY_TIMER = "opendolphin_orca_external_latency";
    private static final int DEFAULT_NETWORK_RETRY_MAX = 3;
    private static final int DEFAULT_TRANSIENT_RETRY_MAX = 2;
    private static final long DEFAULT_NETWORK_BACKOFF_MS = 250L;
    private static final long DEFAULT_TRANSIENT_BACKOFF_MS = 150L;
    private static final int LOG_TEXT_LIMIT = 160;

    private static final ObjectMapper JSON = new ObjectMapper();

    private final HttpClient client;
    private final ServerRuntimeConfiguration.OrcaTransportHttpSettings settings;
    private final OrcaLogMode logMode;
    private final OrcaHttpClientSupport support = new OrcaHttpClientSupport();

    public OrcaHttpClient() {
        this(new ServerConfigurationResolver().orcaTransportHttp());
    }

    OrcaHttpClient(ServerRuntimeConfiguration.OrcaTransportHttpSettings settings) {
        this(HttpClient.newBuilder()
                .connectTimeout(resolveDuration(settings != null ? settings.connectTimeout() : null, DEFAULT_CONNECT_TIMEOUT))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build(),
                settings);
    }

    public OrcaHttpClient(HttpClient client) {
        this(client, null);
    }

    public OrcaHttpClient(HttpClient client, ServerRuntimeConfiguration.OrcaTransportHttpSettings settings) {
        this.client = client;
        this.settings = settings;
        this.logMode = resolveLogMode(settings != null ? settings.logMode() : null);
    }

    public OrcaHttpResponse postXml2(OrcaTransportSettings settings, String path, String body,
            String query, String accept, String requestId, String traceId) {
        return execute(settings, "POST", path, body, query, accept, requestId, traceId);
    }

    public OrcaHttpResponse get(OrcaTransportSettings settings, String path, String query,
            String accept, String requestId, String traceId) {
        return execute(settings, "GET", path, null, query, accept, requestId, traceId);
    }

    private OrcaHttpResponse execute(OrcaTransportSettings transportSettings, String method, String path, String body,
            String query, String accept, String requestId, String traceId) {
        RequestPlan plan = buildRequestPlan(transportSettings, method, path, body, query, accept);
        RetryPlan retryPlan = buildRetryPlan(plan.retryableMethod());
        Instant deadline = Instant.now().plus(retryPlan.totalTimeout());
        int networkAttempts = 0;
        int transientAttempts = 0;
        while (true) {
            ensureDeadline(deadline);
            Instant started = Instant.now();
            try {
                HttpResponse<String> response = sendRequest(plan, requestId, traceId, deadline, retryPlan.readTimeout());
                OrcaResponseOutcome outcome = evaluateResponse(plan, response, started, requestId, networkAttempts,
                        transientAttempts, retryPlan, deadline);
                if (outcome.retryNetwork()) {
                    networkAttempts++;
                    continue;
                }
                if (outcome.retryTransient()) {
                    transientAttempts++;
                    continue;
                }
                return outcome.response();
            } catch (IOException ex) {
                long elapsedMs = Duration.between(started, Instant.now()).toMillis();
                recordExternalMetrics(plan.method(), plan.path(), -1, elapsedMs, FailureCategory.NETWORK.code);
                if (networkAttempts < retryPlan.networkRetryMax()) {
                    networkAttempts++;
                    if (!sleepUntilDeadline(deadline, retryPlan.networkBackoffMs() * (1L << Math.min(networkAttempts, 6)))) {
                        throw failure(FailureCategory.DEADLINE, "ORCA API request deadline exceeded", ex);
                    }
                    continue;
                }
                throw failure(FailureCategory.NETWORK, "Failed to call ORCA API", ex);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                long elapsedMs = Duration.between(started, Instant.now()).toMillis();
                recordExternalMetrics(plan.method(), plan.path(), -1, elapsedMs, FailureCategory.INTERRUPTED.code);
                throw failure(FailureCategory.INTERRUPTED, "ORCA API request interrupted", ex);
            }
        }
    }

    private RequestPlan buildRequestPlan(OrcaTransportSettings transportSettings, String method, String path, String body,
            String query, String accept) {
        if (transportSettings == null || !transportSettings.isReady()) {
            throw new OrcaGatewayException("ORCA transport settings are incomplete");
        }
        String resolvedMethod = method != null && !method.isBlank()
                ? method.trim().toUpperCase(Locale.ROOT)
                : "POST";
        String resolvedAccept = (accept == null || accept.isBlank()) ? ORCA_ACCEPT_XML : accept.trim();
        String url = transportSettings.buildOrcaUrl(path);
        if (query != null && !query.isBlank()) {
            url = url + "?" + query;
        }
        return new RequestPlan(transportSettings, resolvedMethod, path, body, resolvedAccept, url, toUri(url), isRetryableMethod(resolvedMethod));
    }

    private RetryPlan buildRetryPlan(boolean retryableMethod) {
        int networkRetryMax = retryableMethod
                ? resolveIntConfig(this.settings != null ? this.settings.networkRetryMax() : null, DEFAULT_NETWORK_RETRY_MAX)
                : 0;
        int transientRetryMax = retryableMethod
                ? resolveIntConfig(this.settings != null ? this.settings.transientRetryMax() : null, DEFAULT_TRANSIENT_RETRY_MAX)
                : 0;
        long networkBackoff = resolveLongConfig(this.settings != null ? this.settings.networkRetryBackoffMs() : null, DEFAULT_NETWORK_BACKOFF_MS);
        long transientBackoff = resolveLongConfig(this.settings != null ? this.settings.transientRetryBackoffMs() : null, DEFAULT_TRANSIENT_BACKOFF_MS);
        Duration readTimeout = resolveDuration(this.settings != null ? this.settings.readTimeout() : null, DEFAULT_READ_TIMEOUT);
        Duration totalTimeout = resolveDuration(this.settings != null ? this.settings.totalTimeout() : null, DEFAULT_TOTAL_DEADLINE);
        return new RetryPlan(networkRetryMax, transientRetryMax, networkBackoff, transientBackoff, readTimeout, totalTimeout);
    }

    private HttpResponse<String> sendRequest(RequestPlan plan, String requestId, String traceId, Instant deadline, Duration readTimeout)
            throws IOException, InterruptedException {
        Duration requestTimeout = resolveRequestTimeout(deadline, readTimeout);
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(plan.uri())
                .timeout(requestTimeout)
                .header("Accept", plan.accept())
                .header("Authorization", plan.transportSettings().basicAuthHeader());
        if (requestId != null && !requestId.isBlank()) {
            builder.header("X-Request-Id", requestId);
        }
        if (traceId != null && !traceId.isBlank()) {
            builder.header("X-Trace-Id", traceId);
        }
        if ("GET".equalsIgnoreCase(plan.method())) {
            builder.GET();
        } else {
            builder.header("Content-Type", resolveRequestContentType(plan.body()));
            builder.POST(HttpRequest.BodyPublishers.ofString(plan.body() != null ? plan.body() : "", StandardCharsets.UTF_8));
        }
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private OrcaResponseOutcome evaluateResponse(RequestPlan plan, HttpResponse<String> response, Instant started,
            String requestId, int networkAttempts, int transientAttempts, RetryPlan retryPlan, Instant deadline) {
        long elapsedMs = Duration.between(started, Instant.now()).toMillis();
        int status = response.statusCode();
        String responseBody = response.body() != null ? response.body() : "";
        String responseContentType = response.headers().firstValue("Content-Type").orElse(null);
        OrcaApiResult apiResult = extractApiResult(responseBody, responseContentType);
        recordExternalMetrics(plan.method(), plan.path(), status, elapsedMs, null);
        logOrcaSummary(requestId, plan.method(), plan.path(), status, apiResult, elapsedMs);
        if (status < 200 || status >= 300) {
            if (shouldRetryHttp(status, networkAttempts, retryPlan.networkRetryMax())) {
                if (!sleepUntilDeadline(deadline, retryPlan.networkBackoffMs() * (1L << Math.min(networkAttempts + 1, 6)))) {
                    throw failure(FailureCategory.DEADLINE, "ORCA API request deadline exceeded");
                }
                return OrcaResponseOutcome.forNetworkRetryOutcome();
            }
            throw failure(FailureCategory.HTTP_STATUS, "ORCA HTTP response status " + status);
        }
        if (responseBody.isBlank()) {
            if (shouldRetryHttp(status, networkAttempts, retryPlan.networkRetryMax())) {
                if (!sleepUntilDeadline(deadline, retryPlan.networkBackoffMs() * (1L << Math.min(networkAttempts + 1, 6)))) {
                    throw failure(FailureCategory.DEADLINE, "ORCA API request deadline exceeded");
                }
                return OrcaResponseOutcome.forNetworkRetryOutcome();
            }
            throw failure(FailureCategory.EMPTY_BODY, "ORCA HTTP response body is empty");
        }
        if (isTransientOrcaError(apiResult) && transientAttempts < retryPlan.transientRetryMax()) {
            if (!sleepUntilDeadline(deadline, retryPlan.transientBackoffMs())) {
                throw failure(FailureCategory.DEADLINE, "ORCA API request deadline exceeded");
            }
            return OrcaResponseOutcome.forTransientRetryOutcome();
        }
        return OrcaResponseOutcome.successOutcome(new OrcaHttpResponse(plan.url(), plan.method(), status, responseBody, responseContentType,
                response.headers().map(), elapsedMs, apiResult));
    }

    private static void ensureDeadline(Instant deadline) {
        if (isDeadlineExceeded(deadline)) {
            throw failure(FailureCategory.DEADLINE, "ORCA API request deadline exceeded");
        }
    }

    private static void recordExternalMetrics(String method, String path, int status, long elapsedMs, String failureCategory) {
        String resolvedMethod = (method == null || method.isBlank()) ? "POST" : method;
        String resolvedPath = (path == null || path.isBlank()) ? "-" : path;
        String statusValue = status >= 0 ? Integer.toString(status) : "io_error";
        Tags tags = Tags.of("method", resolvedMethod, "path", resolvedPath, "status", statusValue);
        Metrics.counter(ORCA_EXTERNAL_REQUEST_COUNTER, tags).increment();
        Metrics.timer(ORCA_EXTERNAL_LATENCY_TIMER, tags).record(Math.max(0L, elapsedMs), TimeUnit.MILLISECONDS);
        if (status >= 400 || failureCategory != null) {
            Tags errorTags = failureCategory == null
                    ? tags
                    : tags.and("category", failureCategory);
            Metrics.counter(ORCA_EXTERNAL_ERROR_COUNTER, errorTags).increment();
        }
    }

    private static URI toUri(String url) {
        try {
            return new URI(url);
        } catch (Exception ex) {
            throw failure(FailureCategory.INVALID_URL, "Invalid ORCA API URL", ex);
        }
    }

    public static String sanitizeFailureMessage(String message) {
        if (message == null || message.isBlank()) {
            return "Orca gateway error";
        }
        String trimmed = message.trim();
        String category = extractFailureCategory(trimmed);
        if ("invalid_url".equals(category)) {
            return "Invalid ORCA API URL";
        }
        if (containsSensitiveTargetMaterial(trimmed)) {
            return "ORCA transport configuration is invalid";
        }
        return trimmed;
    }

    private void logOrcaSummary(String requestId, String method, String path, int status,
            OrcaApiResult apiResult, long elapsedMs) {
        String logLine = formatSummaryLog(requestId, method, path, status, apiResult, elapsedMs, logMode);
        LOGGER.log(Level.INFO, logLine);
        if (logMode == OrcaLogMode.DETAIL && LOGGER.isLoggable(Level.FINE)) {
            String detail = formatDetailLog(requestId, method, path, status, apiResult, logMode);
            LOGGER.log(Level.FINE, detail);
        }
    }

    private static boolean shouldRetryHttp(int status, int attempt, int maxRetries) {
        if (attempt >= maxRetries) {
            return false;
        }
        if (status >= 400 && status < 500) {
            return false;
        }
        return status >= 500 || status == -1;
    }

    private static boolean isRetryableMethod(String method) {
        if (method == null || method.isBlank()) {
            return false;
        }
        return "GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method);
    }

    private static String resolveRequestContentType(String body) {
        if (OrcaApiProxySupport.isJsonPayload(body)) {
            return ORCA_JSON_CONTENT_TYPE;
        }
        return ORCA_CONTENT_TYPE;
    }

    private static boolean isDeadlineExceeded(Instant deadline) {
        return deadline == null || !Instant.now().isBefore(deadline);
    }

    private static Duration resolveRequestTimeout(Instant deadline, Duration readTimeout) {
        Duration effectiveReadTimeout = readTimeout != null ? readTimeout : DEFAULT_READ_TIMEOUT;
        if (deadline == null) {
            return effectiveReadTimeout;
        }
        long remainingMs = Duration.between(Instant.now(), deadline).toMillis();
        if (remainingMs <= 0) {
            throw failure(FailureCategory.DEADLINE, "ORCA API request deadline exceeded");
        }
        long timeoutMs = Math.min(effectiveReadTimeout.toMillis(), remainingMs);
        return Duration.ofMillis(Math.max(1L, timeoutMs));
    }

    private static OrcaApiResult extractApiResult(String body, String contentType) {
        return new OrcaHttpClientSupport().extractApiResult(body, contentType);
    }

    private static boolean isTransientOrcaError(OrcaApiResult result) {
        return new OrcaHttpClientSupport().isTransientOrcaError(result);
    }

    private static boolean sleepUntilDeadline(Instant deadline, long backoffMs) {
        return new OrcaHttpClientSupport().sleepUntilDeadline(deadline, backoffMs);
    }

    private static int resolveIntConfig(Integer value, int fallback) {
        return new OrcaHttpClientSupport().resolveIntConfig(value, fallback);
    }

    private static long resolveLongConfig(Long value, long fallback) {
        return new OrcaHttpClientSupport().resolveLongConfig(value, fallback);
    }

    private static Duration resolveDuration(Duration value, Duration fallback) {
        return new OrcaHttpClientSupport().resolveDuration(value, fallback);
    }

    private record RequestPlan(
            OrcaTransportSettings transportSettings,
            String method,
            String path,
            String body,
            String accept,
            String url,
            URI uri,
            boolean retryableMethod
    ) {
    }

    private record RetryPlan(
            int networkRetryMax,
            int transientRetryMax,
            long networkBackoffMs,
            long transientBackoffMs,
            Duration readTimeout,
            Duration totalTimeout
    ) {
    }

    private record OrcaResponseOutcome(
            OrcaHttpResponse response,
            boolean retryNetwork,
            boolean retryTransient
    ) {
        private static OrcaResponseOutcome successOutcome(OrcaHttpResponse response) {
            return new OrcaResponseOutcome(response, false, false);
        }

        private static OrcaResponseOutcome forNetworkRetryOutcome() {
            return new OrcaResponseOutcome(null, true, false);
        }

        private static OrcaResponseOutcome forTransientRetryOutcome() {
            return new OrcaResponseOutcome(null, false, true);
        }
    }

    static String formatSummaryLog(String requestId, String method, String path, int status,
            OrcaApiResult apiResult, long elapsedMs) {
        return formatSummaryLog(requestId, method, path, status, apiResult, elapsedMs, OrcaLogMode.SUMMARY);
    }

    static String formatSummaryLog(String requestId, String method, String path, int status,
            OrcaApiResult apiResult, long elapsedMs, OrcaLogMode logMode) {
        String resolvedId = requestId != null && !requestId.isBlank() ? requestId : "-";
        String resolvedMethod = method != null && !method.isBlank() ? method : "POST";
        String resolvedPath = path != null && !path.isBlank() ? path : "-";
        String apiResultCode = apiResult != null && apiResult.apiResult() != null ? apiResult.apiResult() : "-";
        SanitizedText apiMessage = sanitizeLogText(apiResult != null ? apiResult.message() : null);
        String warningsRaw = (apiResult != null && !apiResult.warnings().isEmpty())
                ? String.join(" | ", apiResult.warnings())
                : null;
        SanitizedText warnings = sanitizeLogText(warningsRaw);
        StringBuilder builder = new StringBuilder();
        builder.append("orca.http requestId=").append(resolvedId)
                .append(" method=").append(resolvedMethod)
                .append(" path=").append(resolvedPath)
                .append(" status=").append(status)
                .append(" apiResult=").append(apiResultCode)
                .append(" durationMs=").append(elapsedMs);
        appendText(builder, "apiMessage", apiMessage, logMode);
        appendText(builder, "warnings", warnings, logMode);
        return builder.toString();
    }

    static String formatDetailLog(String requestId, String method, String path, int status,
            OrcaApiResult apiResult, OrcaLogMode logMode) {
        SanitizedText apiMessage = sanitizeLogText(apiResult != null ? apiResult.message() : null);
        String warningsRaw = (apiResult != null && !apiResult.warnings().isEmpty())
                ? String.join(" | ", apiResult.warnings())
                : null;
        SanitizedText warnings = sanitizeLogText(warningsRaw);
        StringBuilder builder = new StringBuilder();
        builder.append("orca.http.detail")
                .append(" requestId=").append(requestId != null ? requestId : "-")
                .append(" method=").append(method != null ? method : "POST")
                .append(" path=").append(path != null ? path : "-")
                .append(" status=").append(status);
        if (apiMessage.display != null) {
            builder.append(" apiMessageSafe=").append(apiMessage.display);
        }
        if (warnings.display != null) {
            builder.append(" warningsSafe=").append(warnings.display);
        }
        if (apiMessage.fingerprint != null) {
            builder.append(" apiMessageHash=").append(apiMessage.fingerprint);
        }
        if (warnings.fingerprint != null) {
            builder.append(" warningsHash=").append(warnings.fingerprint);
        }
        return builder.toString();
    }

    private static void appendText(StringBuilder builder, String label, SanitizedText text, OrcaLogMode logMode) {
        if (text == null) {
            return;
        }
        if (logMode == OrcaLogMode.QUIET) {
            if (text.fingerprint != null) {
                builder.append(' ').append(label).append("Hash=").append(text.fingerprint);
            }
            return;
        }
        if (text.numericOnly || (logMode == OrcaLogMode.DETAIL && text.display != null)) {
            builder.append(' ').append(label).append('=').append(text.display);
            if (text.fingerprint != null && logMode == OrcaLogMode.DETAIL) {
                builder.append(' ').append(label).append("Hash=").append(text.fingerprint);
            }
            return;
        }
        if (text.fingerprint != null) {
            builder.append(' ').append(label).append("Hash=").append(text.fingerprint);
        }
    }

    private static SanitizedText sanitizeLogText(String value) {
        if (value == null || value.isBlank()) {
            return SanitizedText.empty();
        }
        String normalized = value.replaceAll("\\s+", " ").trim();
        String fingerprint = shortHash(normalized);
        if (normalized.matches("[0-9\\-.,/ ]+")) {
            String display = truncate(normalized, LOG_TEXT_LIMIT);
            return new SanitizedText(display, fingerprint, true);
        }
        String maskedDigits = normalized.replaceAll("\\d{4,}", "***");
        String strippedControls = maskedDigits.replaceAll("\\p{Cntrl}", "");
        String truncated = truncate(strippedControls, LOG_TEXT_LIMIT);
        String safeAscii = truncated.replaceAll("[^A-Za-z0-9 _.,:;\\-\\/()\\[\\]{}*]", "***");
        String collapsed = collapseStars(safeAscii);
        boolean numericOnly = collapsed.matches("[0-9* _.,:;\\-\\/()\\[\\]{}]+");
        String display = numericOnly ? collapsed : collapseStars(collapsed.replaceAll("[A-Za-z]", "***"));
        if (display.isBlank()) {
            display = "***";
        }
        return new SanitizedText(truncate(display, LOG_TEXT_LIMIT), fingerprint, false);
    }

    private static String collapseStars(String value) {
        return value.replaceAll("\\*{3,}", "***");
    }

    private static String truncate(String value, int limit) {
        if (value == null || value.length() <= limit) {
            return value;
        }
        return value.substring(0, limit) + "...";
    }

    private static String shortHash(String value) {
        if (value == null) {
            return null;
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (int i = 0; i < Math.min(6, hashed.length); i++) {
                builder.append(String.format("%02x", hashed[i]));
            }
            return builder.toString();
        } catch (Exception ex) {
            return null;
        }
    }

    private static OrcaLogMode resolveLogMode(String value) {
        if (value == null) {
            return OrcaLogMode.SUMMARY;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        switch (normalized) {
            case "QUIET":
                return OrcaLogMode.QUIET;
            case "DETAIL":
            case "DEBUG":
                return OrcaLogMode.DETAIL;
            default:
                return OrcaLogMode.SUMMARY;
        }
    }

    private static OrcaGatewayException failure(FailureCategory category, String message) {
        return new OrcaGatewayException("[" + category.code + "] " + message);
    }

    private static OrcaGatewayException failure(FailureCategory category, String message, Throwable cause) {
        return new OrcaGatewayException("[" + category.code + "] " + message, cause);
    }

    private static String extractFailureCategory(String message) {
        if (message == null || message.isBlank() || message.charAt(0) != '[') {
            return null;
        }
        int end = message.indexOf(']');
        if (end <= 1) {
            return null;
        }
        return message.substring(1, end).trim().toLowerCase(Locale.ROOT);
    }

    private static boolean containsSensitiveTargetMaterial(String message) {
        String lower = message.toLowerCase(Locale.ROOT);
        return lower.contains("://")
                || lower.contains("userinfo")
                || lower.contains("baseurl")
                || lower.contains("base url")
                || lower.contains("host spec")
                || lower.contains("pathprefix")
                || lower.contains("path prefix")
                || lower.contains("@");
    }

    enum OrcaLogMode {
        QUIET,
        SUMMARY,
        DETAIL
    }

    private enum FailureCategory {
        INVALID_URL("invalid_url"),
        NETWORK("network"),
        HTTP_STATUS("http_status"),
        EMPTY_BODY("empty_body"),
        DEADLINE("deadline"),
        INTERRUPTED("interrupted");

        private final String code;

        FailureCategory(String code) {
            this.code = code;
        }
    }

    static final class SanitizedText {
        final String display;
        final String fingerprint;
        final boolean numericOnly;
        private SanitizedText(String display, String fingerprint, boolean numericOnly) {
            this.display = display;
            this.fingerprint = fingerprint;
            this.numericOnly = numericOnly;
        }

        static SanitizedText empty() {
            return new SanitizedText(null, null, false);
        }
    }

    public static final class OrcaHttpResponse {
        private final String url;
        private final String method;
        private final int status;
        private final String body;
        private final String contentType;
        private final Map<String, List<String>> headers;
        private final long elapsedMs;
        private final OrcaApiResult apiResult;

        private OrcaHttpResponse(String url, String method, int status, String body, String contentType,
                Map<String, List<String>> headers, long elapsedMs, OrcaApiResult apiResult) {
            this.url = url;
            this.method = method;
            this.status = status;
            this.body = body;
            this.contentType = contentType;
            this.headers = copyHeaders(headers);
            this.elapsedMs = elapsedMs;
            this.apiResult = apiResult;
        }

        public String url() {
            return url;
        }

        public String method() {
            return method;
        }

        public int status() {
            return status;
        }

        public String body() {
            return body;
        }

        public String contentType() {
            return contentType;
        }

        public Map<String, List<String>> headers() {
            return headers.isEmpty() ? Map.of() : copyHeaders(headers);
        }

        public long elapsedMs() {
            return elapsedMs;
        }

        public OrcaApiResult apiResult() {
            return apiResult;
        }
    }

    private static Map<String, List<String>> copyHeaders(Map<String, List<String>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<String, List<String>> copy = new LinkedHashMap<>();
        for (Map.Entry<String, List<String>> entry : source.entrySet()) {
            if (entry.getKey() == null) {
                continue;
            }
            List<String> value = entry.getValue();
            copy.put(entry.getKey(), value == null ? List.of() : List.copyOf(value));
        }
        return Map.copyOf(copy);
    }
}

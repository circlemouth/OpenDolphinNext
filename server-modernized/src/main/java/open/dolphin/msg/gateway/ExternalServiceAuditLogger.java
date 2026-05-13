package open.dolphin.msg.gateway;

import com.plivo.api.models.message.MessageCreateResponse;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.function.Supplier;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * 外部サービス（ORCA・Plivo など）向けの監査ログを集約するユーティリティ。
 */
public final class ExternalServiceAuditLogger {

    private static final Logger AUDIT_LOGGER = Logger.getLogger("open.dolphin.audit.external");
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_INSTANT;

    private ExternalServiceAuditLogger() {
    }

    public static void logSmsRequest(String traceId, List<String> destinations, SmsGatewayConfig.PlivoSettings settings) {
        log(Level.INFO, "SMS_REQUEST", traceId,
                () -> smsSummary(destinations, null),
                () -> smsSettingsSummary(settings),
                null);
    }

    public static void logSmsSuccess(String traceId, List<String> destinations, SmsGatewayConfig.PlivoSettings settings, MessageCreateResponse response) {
        log(Level.INFO, "SMS_SUCCESS", traceId,
                () -> smsSummary(destinations, response),
                () -> smsSettingsSummary(settings),
                null);
    }

    public static void logSmsFailure(String traceId, List<String> destinations, SmsGatewayConfig.PlivoSettings settings, Throwable error) {
        log(Level.WARNING, "SMS_FAILURE", traceId,
                () -> smsSummary(destinations, null),
                () -> smsSettingsSummary(settings),
                error);
    }

    public static void logOrcaRequest(String traceId, String action, String path, String targetSummary) {
        log(Level.INFO, "ORCA_REQUEST", traceId,
                () -> orcaPayloadSummary(action, path),
                () -> targetSummary,
                null);
    }

    public static void logOrcaResponse(String traceId, String action, String path, int status, String targetSummary) {
        log(Level.INFO, "ORCA_RESPONSE", traceId,
                () -> orcaPayloadSummary(action, path) + " http.status=" + status,
                () -> targetSummary,
                null);
    }

    public static void logOrcaFailure(String traceId, String action, String path, String targetSummary, Throwable error) {
        log(Level.WARNING, "ORCA_FAILURE", traceId,
                () -> orcaPayloadSummary(action, path),
                () -> targetSummary,
                error);
    }

    public static void logOrcaRequestDetail(String traceId, String url, String method,
            String contentType, String accept, String body) {
        log(Level.INFO, "ORCA_REQUEST_DETAIL", traceId,
                () -> buildOrcaRequestDetail(url, method, contentType, accept, body),
                null,
                null);
    }

    public static void logOrcaRequestDetailFull(String traceId, String url, String method,
            java.util.Map<String, java.util.List<String>> headers, String body) {
        log(Level.INFO, "ORCA_REQUEST_FULL", traceId,
                () -> buildOrcaRequestFull(url, method, headers, body),
                null,
                null);
    }

    public static void logOrcaResponseDetail(String traceId, String url, int status,
            java.util.Map<String, java.util.List<String>> headers, String body) {
        log(Level.INFO, "ORCA_RESPONSE_DETAIL", traceId,
                () -> buildOrcaResponseDetail(url, status, headers, body),
                null,
                null);
    }

    private static void log(Level level, String event, String traceId,
            Supplier<String> payloadSummarySupplier,
            Supplier<String> settingsSummarySupplier,
            Throwable error) {
        if (!AUDIT_LOGGER.isLoggable(level)) {
            return;
        }
        String payloadSummary = payloadSummarySupplier != null ? payloadSummarySupplier.get() : null;
        String settingsSummary = settingsSummarySupplier != null ? settingsSummarySupplier.get() : null;
        StringBuilder builder = new StringBuilder();
        builder.append("event=").append(event);
        builder.append(" timestamp=").append(FORMATTER.format(Instant.now()));
        if (traceId != null) {
            builder.append(" traceId=").append(traceId);
        }
        if (payloadSummary != null) {
            builder.append(' ').append(payloadSummary);
        }
        if (settingsSummary != null) {
            builder.append(' ').append(settingsSummary);
        }
        if (error == null) {
            AUDIT_LOGGER.log(level, builder.toString());
        } else {
            AUDIT_LOGGER.log(level, builder.toString(), error);
        }
    }

    private static String smsSummary(List<String> destinations, MessageCreateResponse response) {
        int count = destinations != null ? destinations.size() : 0;
        StringBuilder builder = new StringBuilder();
        builder.append("sms.recipients=").append(count);
        if (destinations != null && !destinations.isEmpty()) {
            builder.append(" sms.destinations=").append(maskDestinations(destinations));
        }
        if (response != null && response.getMessageUuid() != null) {
            builder.append(" sms.messageUuid=").append(response.getMessageUuid());
        }
        return builder.toString();
    }

    private static String smsSettingsSummary(SmsGatewayConfig.PlivoSettings settings) {
        if (settings == null) {
            return "plivo.environment=unknown";
        }
        return String.format("plivo.environment=%s plivo.source=%s", safe(settings.environment()), safe(settings.sourceNumber()));
    }

    private static String orcaPayloadSummary(String action, String path) {
        String resolvedAction = action != null ? action : "ORCA_HTTP";
        String resolvedPath = path != null ? path : "unknown";
        return "orca.action=" + resolvedAction + " orca.path=" + resolvedPath;
    }

    private static String buildOrcaRequestDetail(String url, String method,
            String contentType, String accept, String body) {
        String resolvedUrl = sanitizeOrcaUrl(url);
        String resolvedMethod = method != null ? method : "POST";
        String resolvedContentType = contentType != null ? contentType : "";
        String resolvedAccept = accept != null ? accept : "";
        String preview = maskSensitiveXml(buildBodyPreview(body));
        return "orca.url=" + resolvedUrl
                + " orca.method=" + resolvedMethod
                + " orca.contentType=" + resolvedContentType
                + " orca.accept=" + resolvedAccept
                + " orca.bodySnippet=" + preview;
    }

    private static String buildOrcaRequestFull(String url, String method,
            java.util.Map<String, java.util.List<String>> headers, String body) {
        String resolvedUrl = sanitizeOrcaUrl(url);
        String resolvedMethod = method != null ? method : "POST";
        String headerText = formatHeaders(headers);
        String payload = body != null ? body : "";
        return "orca.url=" + resolvedUrl
                + " orca.method=" + resolvedMethod
                + " orca.headers=" + headerText
                + " orca.body=" + maskSensitivePayload(normalizeBody(payload));
    }

    private static String buildOrcaResponseDetail(String url, int status,
            java.util.Map<String, java.util.List<String>> headers, String body) {
        String resolvedUrl = sanitizeOrcaUrl(url);
        String headerText = formatHeaders(headers);
        String payload = body != null ? body : "";
        return "orca.url=" + resolvedUrl
                + " http.status=" + status
                + " orca.headers=" + headerText
                + " orca.body=" + maskSensitivePayload(normalizeBody(payload));
    }

    private static String normalizeBody(String body) {
        if (body == null) {
            return "";
        }
        return body.replace("\r", "\\r").replace("\n", "\\n");
    }

    private static String sanitizeOrcaUrl(String url) {
        if (url == null || url.isBlank()) {
            return "unknown";
        }
        try {
            java.net.URI uri = java.net.URI.create(url);
            String path = uri.getPath();
            return path == null || path.isBlank() ? "configured-orca-target" : path;
        } catch (RuntimeException ex) {
            return "configured-orca-target";
        }
    }

    private static String formatHeaders(java.util.Map<String, java.util.List<String>> headers) {
        if (headers == null || headers.isEmpty()) {
            return "[]";
        }
        StringBuilder builder = new StringBuilder();
        builder.append('[');
        boolean first = true;
        for (java.util.Map.Entry<String, java.util.List<String>> entry : headers.entrySet()) {
            if (!first) {
                builder.append(", ");
            }
            first = false;
            String key = entry.getKey();
            String value = headerValue(entry.getValue());
            builder.append(key).append('=').append(maskHeader(key, value));
        }
        builder.append(']');
        return builder.toString();
    }

    private static String headerValue(java.util.List<String> values) {
        if (values == null || values.isEmpty()) {
            return "";
        }
        if (values.size() == 1) {
            return values.get(0);
        }
        return values.toString();
    }

    private static String maskHeader(String key, String value) {
        if (key == null) {
            return value;
        }
        String normalized = key.trim().toLowerCase(Locale.ROOT);
        if (normalized.equals("authorization")) {
            return maskAuthorization(value);
        }
        if (normalized.equals("cookie") || normalized.equals("set-cookie")) {
            return "***";
        }
        return value;
    }

    private static String maskAuthorization(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        if (value.toLowerCase(Locale.ROOT).startsWith("basic ")) {
            return "Basic ***";
        }
        return "***";
    }

    private static List<String> maskDestinations(List<String> destinations) {
        return destinations.stream()
                .map(ExternalServiceAuditLogger::maskPhoneNumber)
                .collect(Collectors.toList());
    }

    private static String maskPhoneNumber(String destination) {
        if (destination == null || destination.isBlank()) {
            return destination;
        }
        return destination.replaceAll("\\d(?=\\D*\\d{4}\\D*$)", "*");
    }

    private static String buildBodyPreview(String body) {
        if (body == null || body.isBlank()) {
            return "";
        }
        String[] lines = body.split("\\R", -1);
        int lineCount = Math.min(lines.length, 5);
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < lineCount; i++) {
            if (i > 0) {
                builder.append("\\n");
            }
            builder.append(lines[i]);
        }
        String preview = builder.toString();
        if (preview.length() > 800) {
            preview = preview.substring(0, 800);
        }
        return preview;
    }

    private static String maskSensitiveXml(String snippet) {
        if (snippet == null || snippet.isBlank()) {
            return "";
        }
        String masked = snippet;
        Pattern pattern = Pattern.compile(
                "(?is)<([a-z0-9_:-]*?(name|kana|patient|address)[a-z0-9_:-]*?)\\b[^>]*>(.*?)</\\1>");
        Matcher matcher = pattern.matcher(masked);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            String tag = matcher.group(1);
            matcher.appendReplacement(buffer, "<" + tag + ">***</" + tag + ">");
        }
        matcher.appendTail(buffer);
        String replaced = buffer.toString();
        if (replaced.toLowerCase(Locale.ROOT).contains("<patient")) {
            replaced = replaced.replaceAll("(?is)<patient[^>]*>.*?</patient>", "<patient>***</patient>");
        }
        return replaced;
    }

    private static String maskSensitivePayload(String payload) {
        if (payload == null || payload.isBlank()) {
            return payload;
        }
        String trimmed = payload.trim();
        if (trimmed.startsWith("<")) {
            return maskSensitiveXml(payload);
        }
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            return maskSensitiveJson(payload);
        }
        return payload;
    }

    private static String maskSensitiveJson(String payload) {
        String masked = payload;
        Pattern pattern = Pattern.compile(
                "(?i)\"([^\"]*(name|kana|patient|address)[^\"]*)\"\\s*:\\s*\"([^\"]*)\"");
        Matcher matcher = pattern.matcher(masked);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            String key = matcher.group(1);
            matcher.appendReplacement(buffer, "\"" + key + "\":\"***\"");
        }
        matcher.appendTail(buffer);
        return buffer.toString();
    }

    private static String safe(String value) {
        return value != null ? value : "";
    }

}

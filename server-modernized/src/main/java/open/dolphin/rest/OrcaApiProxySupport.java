package open.dolphin.rest;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Pattern;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;

/**
 * Shared helpers for ORCA API proxy resources.
 */
public final class OrcaApiProxySupport {

    private static final Logger LOGGER = Logger.getLogger(OrcaApiProxySupport.class.getName());
    private static final Pattern CONTROL_CHARS = Pattern.compile("[\\x00-\\x1F\\x7F]");

    private OrcaApiProxySupport() {
    }

    public static Response buildProxyResponse(OrcaTransportResult result, String runIdHeader) {
        if (result == null) {
            return Response.serverError().build();
        }
        String runId = AbstractOrcaRestResource.resolveRunIdValue(runIdHeader);
        MediaType mediaType = resolveMediaType(result.getContentType());
        Response.ResponseBuilder builder = Response.ok(result.getBody(), mediaType);
        String sanitizedRunId = sanitizeHeaderValue("X-Run-Id", runId);
        if (sanitizedRunId != null) {
            builder.header("X-Run-Id", sanitizedRunId);
        }
        if (!isForwardXOrcaHeadersEnabled()) {
            return builder.build();
        }
        if (result.getHeaders() != null) {
            result.getHeaders().forEach((name, values) -> {
                if (name == null || values == null || values.isEmpty()) {
                    return;
                }
                String trimmed = name.trim();
                if (trimmed.isEmpty() || containsControlChars(trimmed)) {
                    logDroppedHeader(trimmed, values, "invalid_name");
                    return;
                }
                if (isApiResultMessageHeader(trimmed)) {
                    return;
                }
                for (String value : values) {
                    String sanitized = sanitizeHeaderValue(trimmed, value);
                    if (sanitized == null) {
                        continue;
                    }
                    if (trimmed.startsWith("X-Orca-")) {
                        builder.header(trimmed, sanitized);
                    }
                }
            });
        }
        return builder.build();
    }

    public static String sanitizeHeaderValue(String value) {
        return sanitizeHeaderValue(null, value);
    }

    public static String sanitizeHeaderValue(String headerName, String value) {
        if (value == null) {
            return null;
        }
        if (!containsControlChars(value)) {
            return value;
        }
        String sanitized = CONTROL_CHARS.matcher(value).replaceAll("");
        if (sanitized.isBlank()) {
            logDroppedHeader(headerName, value, "empty_after_sanitize");
            return null;
        }
        logSanitizedHeader(headerName, value, sanitized);
        return sanitized;
    }

    public static boolean isForwardXOrcaHeadersEnabled() {
        return isForwardXOrcaHeadersEnabled(new ServerConfigurationResolver());
    }

    public static boolean isApiResultMessageHeaderEnabled() {
        return isApiResultMessageHeaderEnabled(new ServerConfigurationResolver());
    }

    static boolean isForwardXOrcaHeadersEnabled(ServerConfigurationResolver resolver) {
        ServerRuntimeConfiguration.OrcaProxySettings settings = resolver.orcaProxy();
        return settings.forwardXOrcaHeaders() == null || settings.forwardXOrcaHeaders();
    }

    static boolean isApiResultMessageHeaderEnabled(ServerConfigurationResolver resolver) {
        ServerRuntimeConfiguration.OrcaProxySettings settings = resolver.orcaProxy();
        return settings.forwardApiResultMessageHeader() == null || settings.forwardApiResultMessageHeader();
    }

    private static boolean isApiResultMessageHeader(String headerName) {
        return headerName != null && "X-Orca-Api-Result-Message".equalsIgnoreCase(headerName);
    }

    private static boolean containsControlChars(String value) {
        return value != null && CONTROL_CHARS.matcher(value).find();
    }

    private static void logDroppedHeader(String headerName, Object values, String reason) {
        if (LOGGER.isLoggable(Level.WARNING)) {
            LOGGER.log(Level.WARNING, "Dropping response header ({0}) due to {1}.",
                    new Object[]{headerName == null ? "unknown" : headerName, reason});
        }
    }

    private static void logSanitizedHeader(String headerName, String original, String sanitized) {
        if (!LOGGER.isLoggable(Level.FINE)) {
            return;
        }
        int originalLength = original != null ? original.length() : 0;
        int sanitizedLength = sanitized != null ? sanitized.length() : 0;
        LOGGER.log(Level.FINE, "Sanitized response header ({0}) value length {1} -> {2}.",
                new Object[]{headerName == null ? "unknown" : headerName, originalLength, sanitizedLength});
    }

    public static MediaType resolveMediaType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return MediaType.APPLICATION_XML_TYPE;
        }
        String normalized = contentType.toLowerCase();
        if (normalized.contains("json")) {
            return MediaType.APPLICATION_JSON_TYPE;
        }
        if (normalized.contains("xml")) {
            return MediaType.APPLICATION_XML_TYPE;
        }
        return MediaType.TEXT_PLAIN_TYPE;
    }

    public static boolean isJsonPayload(String payload) {
        if (payload == null) {
            return false;
        }
        String trimmed = payload.trim();
        return trimmed.startsWith("{") || trimmed.startsWith("[");
    }

    public static boolean isApiResultSuccess(String apiResult) {
        if (apiResult == null || apiResult.isBlank()) {
            return false;
        }
        for (int i = 0; i < apiResult.length(); i++) {
            if (apiResult.charAt(i) != '0') {
                return false;
            }
        }
        return true;
    }

    public static String applyQueryMeta(String payload, OrcaEndpoint endpoint, String classCode) {
        if (payload == null || payload.isBlank()) {
            return payload;
        }
        if (endpoint == null || classCode == null || classCode.isBlank()) {
            return payload;
        }
        String trimmed = payload.trim();
        String meta = "<!-- orca-meta: path=" + endpoint.getPath()
                + " method=POST query=class=" + classCode.trim() + " -->";
        if (trimmed.startsWith("<!--") && trimmed.contains("orca-meta:")) {
            return meta + trimmed;
        }
        return meta + trimmed;
    }
}

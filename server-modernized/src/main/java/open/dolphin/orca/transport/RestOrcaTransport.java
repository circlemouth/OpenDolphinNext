package open.dolphin.orca.transport;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.msg.gateway.ExternalServiceAuditLogger;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.orca.transport.OrcaHttpClient.OrcaHttpResponse;
import open.dolphin.orca.transport.OrcaTransportRegistry.OrcaResolvedTransport;
import open.dolphin.rest.OrcaApiProxySupport;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;
import open.dolphin.session.framework.SessionTraceAttributes;
import open.dolphin.session.framework.SessionTraceContext;
import open.dolphin.session.framework.SessionTraceManager;
import org.jboss.logmanager.MDC;

/**
 * HTTP transport for ORCA API endpoints using Basic auth.
 */
@ApplicationScoped
public class RestOrcaTransport implements OrcaTransport {

    private static final Logger LOGGER = Logger.getLogger(RestOrcaTransport.class.getName());
    private static final String ORCA_ACCEPT = "application/xml";
    public static final String UNKNOWN_AUDIT_SUMMARY = "orca.mode=unknown credentialConfigured=false clientAuthConfigured=false";
    public static final String REASON_CODE_TRANSPORT_NOT_READY = "orca_transport_not_ready";
    public static final String REASON_CODE_HTTP_CLIENT_UNAVAILABLE = "orca_http_client_unavailable";
    public static final String REASON_CODE_PROBE_FAILED = "orca_probe_failed";
    private static final ObjectMapper JSON = new ObjectMapper();

    private static final long DEFAULT_CACHE_TTL_MS = 30_000L;
    private static final Duration READINESS_PROBE_TIMEOUT = Duration.ofSeconds(3);
    private volatile OrcaTransportRegistry registry;

    @Inject
    SessionTraceManager traceManager;

    @Inject
    OrcaConnectionConfigStore orcaConnectionConfigStore;

    @Inject
    ServerConfigurationResolver configurationResolver;

    @PostConstruct
    private void initialize() {
        OrcaTransportSettings settings = reloadSettings();
        if (settings != null) {
            LOGGER.log(Level.INFO, "ORCA transport settings loaded: {0}", settings.auditSummary());
        } else {
            LOGGER.log(Level.WARNING, "ORCA transport settings could not be loaded during initialization");
        }
    }

    @Override
    public String invoke(OrcaEndpoint endpoint, String requestXml) {
        OrcaTransportResult result = invokeDetailed(endpoint, OrcaTransportRequest.post(requestXml));
        return result != null ? result.getBody() : null;
    }

    @Override
    public OrcaTransportResult invokeDetailed(OrcaEndpoint endpoint, OrcaTransportRequest request) {
        String facilityId = resolveFacilityId();
        OrcaResolvedTransport transport = registry().currentTransport(facilityId);
        OrcaTransportSettings resolved = transport != null ? transport.settings() : null;
        OrcaHttpClient activeHttpClient = transport != null ? transport.httpClient() : null;

        if (resolved == null || activeHttpClient == null) {
            LOGGER.log(Level.WARNING, "ORCA transport settings unavailable; attempting reload (endpoint={0}, facilityId={1})",
                    new Object[]{endpoint != null ? endpoint.getPath() : "unknown", safeFacility(facilityId)});
            resolved = reloadSettings(facilityId);
            transport = registry().currentTransport(facilityId);
            activeHttpClient = transport != null ? transport.httpClient() : null;
        }

        String traceId = resolveTraceId();
        String action = "ORCA_HTTP";
        if (endpoint == null) {
            OrcaGatewayException failure = new OrcaGatewayException("Endpoint must not be null");
            ExternalServiceAuditLogger.logOrcaFailure(traceId, action, null, auditSummary(resolved), failure);
            throw failure;
        }
        if (resolved == null || activeHttpClient == null || !resolved.isReady()) {
            OrcaGatewayException failure = new OrcaGatewayException("ORCA transport settings are incomplete");
            ExternalServiceAuditLogger.logOrcaFailure(traceId, action, endpoint.getPath(), auditSummary(resolved), failure);
            throw failure;
        }

        String payload = request != null && request.getBody() != null ? request.getBody() : "";
        String method = resolveMethod(endpoint, request);
        boolean isGet = "GET".equalsIgnoreCase(method);
        if (endpoint.requiresBody() && payload.isBlank()) {
            logMissingBody(traceId, endpoint, resolved);
            OrcaGatewayException failure = new OrcaGatewayException("ORCA request body is required for " + endpoint.getPath());
            ExternalServiceAuditLogger.logOrcaFailure(traceId, action, endpoint.getPath(), resolved.auditSummary(), failure);
            throw failure;
        }
        List<String> missingFields = isGet ? List.of() : findMissingFields(endpoint, payload);
        if (!missingFields.isEmpty()) {
            logMissingFields(traceId, endpoint, resolved, missingFields);
            OrcaGatewayException failure = new OrcaGatewayException(
                    "ORCA request body is missing required fields: " + String.join(", ", missingFields));
            ExternalServiceAuditLogger.logOrcaFailure(traceId, action, endpoint.getPath(), resolved.auditSummary(), failure);
            throw failure;
        }

        String requestId = traceId;
        String query = resolveQuery(endpoint, payload, request);
        String url = resolved.buildUrl(endpoint, query);
        String accept = resolveAccept(endpoint, request);
        try {
            ExternalServiceAuditLogger.logOrcaRequest(traceId, action, endpoint.getPath(), resolved.auditSummary());
            OrcaHttpResponse response = isGet
                    ? activeHttpClient.get(resolved, endpoint.getPath(), query, accept, requestId, traceId)
                    : activeHttpClient.postXml2(resolved, endpoint.getPath(), payload, query, accept, requestId, traceId);
            ExternalServiceAuditLogger.logOrcaResponse(traceId, action, endpoint.getPath(), response.status(), resolved.auditSummary());
            Map<String, List<String>> headers = new java.util.LinkedHashMap<>(response.headers());
            if (response.apiResult() != null && response.apiResult().apiResult() != null) {
                String apiResult = response.apiResult().apiResult();
                String sanitizedApiResult = OrcaApiProxySupport.sanitizeHeaderValue("X-Orca-Api-Result", apiResult);
                if (sanitizedApiResult != null) {
                    headers.put("X-Orca-Api-Result", List.of(sanitizedApiResult));
                    headers.put("X-Orca-Api-Result-Success",
                            List.of(Boolean.toString(OrcaApiProxySupport.isApiResultSuccess(sanitizedApiResult))));
                }
                // Api_Result_Message can contain control characters; omit header to avoid invalid response headers.
                if (response.apiResult().warnings() != null && !response.apiResult().warnings().isEmpty()) {
                    String warnings = String.join(" | ", response.apiResult().warnings());
                    String sanitized = OrcaApiProxySupport.sanitizeHeaderValue("X-Orca-Warnings", warnings);
                    if (sanitized != null) {
                        headers.put("X-Orca-Warnings", List.of(sanitized));
                    }
                }
            }
            return new OrcaTransportResult(url, method, response.status(), response.body(), response.contentType(), headers);
        } catch (RuntimeException ex) {
            ExternalServiceAuditLogger.logOrcaFailure(traceId, action, endpoint.getPath(), resolved.auditSummary(), ex);
            throw ex;
        }
    }

    private static String resolveMethod(OrcaEndpoint endpoint, OrcaTransportRequest request) {
        if (request != null && request.getMethod() != null && !request.getMethod().isBlank()) {
            return request.getMethod().trim().toUpperCase(Locale.ROOT);
        }
        if (endpoint != null && endpoint.getMethod() != null && !endpoint.getMethod().isBlank()) {
            return endpoint.getMethod().trim().toUpperCase(Locale.ROOT);
        }
        return "POST";
    }

    private static String resolveAccept(OrcaEndpoint endpoint, OrcaTransportRequest request) {
        if (request != null && request.getAccept() != null && !request.getAccept().isBlank()) {
            return request.getAccept().trim();
        }
        return endpoint != null && endpoint.getAccept() != null ? endpoint.getAccept() : ORCA_ACCEPT;
    }

    private static String resolveQuery(OrcaEndpoint endpoint, String payload, OrcaTransportRequest request) {
        if (request != null && request.getQuery() != null && !request.getQuery().isBlank()) {
            return request.getQuery().trim();
        }
        return extractQueryFromMeta(endpoint, payload);
    }

    private String resolveTraceId() {
        if (traceManager == null) {
            return null;
        }
        SessionTraceContext context = traceManager.current();
        return context != null ? context.getTraceId() : null;
    }

    public HttpClient rawHttpClient() {
        return registry().rawHttpClient(resolveFacilityId());
    }

    public ProbeResult probeReadiness() {
        String facilityId = resolveFacilityId();
        OrcaTransportSettings settings = currentSettings(facilityId);
        String mode = settings != null ? settings.getMode() : "unknown";
        boolean credentialConfigured = settings != null && settings.hasCredentials();
        boolean clientAuthConfigured = settings != null && settings.isClientAuthConfigured();
        if (settings == null || !settings.isReady()) {
            return new ProbeResult(false, mode, credentialConfigured, clientAuthConfigured, REASON_CODE_TRANSPORT_NOT_READY);
        }

        HttpClient client = registry().rawHttpClient(facilityId);
        if (client == null) {
            return new ProbeResult(false, mode, credentialConfigured, clientAuthConfigured, REASON_CODE_HTTP_CLIENT_UNAVAILABLE);
        }

        String url = settings.buildOrcaUrl("");
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
                    .GET()
                    .timeout(READINESS_PROBE_TIMEOUT)
                    .header("Accept", ORCA_ACCEPT);
            String authHeader = settings.basicAuthHeader();
            if (authHeader != null && !authHeader.isBlank()) {
                builder.header("Authorization", authHeader);
            }
            HttpResponse<Void> response = client.send(builder.build(), HttpResponse.BodyHandlers.discarding());
            int statusCode = response.statusCode();
            boolean reachable = (statusCode >= 200 && statusCode < 400)
                    || statusCode == 401
                    || statusCode == 403;
            return new ProbeResult(reachable, mode, credentialConfigured, clientAuthConfigured,
                    reachable ? null : REASON_CODE_PROBE_FAILED);
        } catch (IOException ex) {
            return new ProbeResult(false, mode, credentialConfigured, clientAuthConfigured, REASON_CODE_PROBE_FAILED);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new ProbeResult(false, mode, credentialConfigured, clientAuthConfigured, REASON_CODE_PROBE_FAILED);
        } catch (RuntimeException ex) {
            return new ProbeResult(false, mode, credentialConfigured, clientAuthConfigured, REASON_CODE_PROBE_FAILED);
        }
    }

    public String buildOrcaUrl(String path) {
        return buildOrcaUrl(resolveFacilityId(), path);
    }

    public String buildOrcaUrl(String facilityId, String path) {
        OrcaTransportSettings settings = currentSettings(facilityId);
        return settings != null ? settings.buildOrcaUrl(path) : null;
    }

    public String resolveBasicAuthHeader() {
        return resolveBasicAuthHeader(resolveFacilityId());
    }

    public String resolveBasicAuthHeader(String facilityId) {
        OrcaTransportSettings settings = currentSettings(facilityId);
        if (settings == null || !settings.hasCredentials()) {
            return null;
        }
        return settings.basicAuthHeader();
    }

    public OrcaTransportSettings reloadSettings() {
        return reloadSettings(null);
    }

    public OrcaTransportSettings reloadSettings(String facilityId) {
        OrcaTransportSettings settings = registry().reloadSettings(facilityId);
        if (settings != null) {
            LOGGER.log(Level.INFO, "ORCA transport settings reloaded: {0} facilityId={1}",
                    new Object[]{settings.auditSummary(), safeFacility(facilityId)});
        } else {
            LOGGER.log(Level.WARNING, "ORCA transport settings reload failed: settings null facilityId={0}",
                    safeFacility(facilityId));
        }
        return settings;
    }

    public OrcaTransportSettings currentSettingsInstance() {
        return currentSettings(resolveFacilityId());
    }

    public OrcaTransportSettings currentSettingsInstance(String facilityId) {
        return currentSettings(facilityId);
    }

    public String auditSummary() {
        return auditSummary(resolveFacilityId());
    }

    public String auditSummary(String facilityId) {
        OrcaTransportSettings settings = currentSettings(facilityId);
        return settings != null ? settings.auditSummary() : UNKNOWN_AUDIT_SUMMARY;
    }

    private OrcaTransportSettings currentSettings(String facilityId) {
        return registry().currentSettings(facilityId);
    }

    private String resolveFacilityId() {
        SessionTraceContext context = traceManager != null ? traceManager.current() : null;
        if (context != null) {
            String fromFacilityAttr = normalizeFacilityId(context.getAttribute(SessionTraceAttributes.FACILITY_ID));
            if (fromFacilityAttr != null) {
                return fromFacilityAttr;
            }
            String fromActor = extractFacilityFromCompositeActor(context.getAttribute(SessionTraceAttributes.ACTOR_ID));
            if (fromActor != null) {
                return fromActor;
            }
        }

        String mdcActor = resolveActorFromMdc();
        return extractFacilityFromCompositeActor(mdcActor);
    }

    private String resolveActorFromMdc() {
        Object fromJboss = MDC.get(SessionTraceAttributes.ACTOR_ID_MDC_KEY);
        if (fromJboss instanceof String actor && !actor.isBlank()) {
            return actor;
        }
        String fromSlf4j = org.slf4j.MDC.get(SessionTraceAttributes.ACTOR_ID_MDC_KEY);
        if (fromSlf4j != null && !fromSlf4j.isBlank()) {
            return fromSlf4j;
        }
        return null;
    }

    private static String extractFacilityFromCompositeActor(String actorId) {
        String normalized = normalizeFacilityId(actorId);
        if (normalized == null) {
            return null;
        }
        int idx = normalized.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (idx <= 0) {
            return null;
        }
        return normalizeFacilityId(normalized.substring(0, idx));
    }

    private static String normalizeFacilityId(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String safeFacility(String facilityId) {
        return facilityId != null ? facilityId : "default";
    }

    private static String auditSummary(OrcaTransportSettings settings) {
        return settings != null ? settings.auditSummary() : "orca.mode=unknown credentialConfigured=false clientAuthConfigured=false";
    }

    private OrcaTransportRegistry registry() {
        OrcaTransportRegistry current = registry;
        if (current != null) {
            return current;
        }
        synchronized (this) {
            if (registry == null) {
                registry = new OrcaTransportRegistry(orcaConnectionConfigStore, resolveCacheTtlMs(), resolver());
            }
            return registry;
        }
    }

    private long resolveCacheTtlMs() {
        ServerRuntimeConfiguration.OrcaTransportHttpSettings settings = resolver().orcaTransportHttp();
        Long configured = settings != null ? settings.cacheTtlMs() : null;
        return configured != null ? Math.max(0L, configured) : DEFAULT_CACHE_TTL_MS;
    }

    private ServerConfigurationResolver resolver() {
        return configurationResolver != null ? configurationResolver : new ServerConfigurationResolver();
    }

    public record ProbeResult(
            boolean reachable,
            String mode,
            boolean credentialConfigured,
            boolean clientAuthConfigured,
            String reasonCode) {
    }

    public static ProbeResult unavailableProbe(String reasonCode) {
        return new ProbeResult(false, "unknown", false, false, reasonCode);
    }

    private static void logMissingBody(String traceId, OrcaEndpoint endpoint, OrcaTransportSettings settings) {
        List<String> fields = endpoint != null ? endpoint.requiredFields() : List.of();
        String fieldSummary = fields.isEmpty() ? "unknown" : String.join(",", fields);
        LOGGER.log(Level.WARNING, "ORCA request body is missing traceId={0} path={1} requiredFields={2} target={3}",
                new Object[]{traceId, endpoint != null ? endpoint.getPath() : "unknown", fieldSummary,
                        settings != null ? settings.auditSummary() : "orca.mode=unknown credentialConfigured=false clientAuthConfigured=false"});
    }

    private static void logMissingFields(String traceId, OrcaEndpoint endpoint, OrcaTransportSettings settings,
            List<String> missingFields) {
        String fieldSummary = (missingFields == null || missingFields.isEmpty())
                ? "unknown"
                : String.join(",", missingFields);
        LOGGER.log(Level.WARNING, "ORCA request body missing required fields traceId={0} path={1} missing={2} target={3}",
                new Object[]{traceId, endpoint != null ? endpoint.getPath() : "unknown", fieldSummary,
                        settings != null ? settings.auditSummary() : "orca.mode=unknown credentialConfigured=false clientAuthConfigured=false"});
    }

    private static List<String> findMissingFields(OrcaEndpoint endpoint, String payload) {
        if (endpoint == null) {
            return List.of();
        }
        List<String> required = endpoint.requiredFields();
        if (required == null || required.isEmpty()) {
            return List.of();
        }
        JsonNode jsonRoot = parseJsonPayload(payload);
        List<String> missing = new ArrayList<>();
        for (String spec : required) {
            if (spec == null || spec.isBlank()) {
                continue;
            }
            String trimmed = spec.trim();
            if (trimmed.contains("/")) {
                String[] options = trimmed.split("/");
                boolean found = false;
                for (String option : options) {
                    String candidate = option.trim();
                    if (candidate.isEmpty()) {
                        continue;
                    }
                    if (hasRequiredFieldWithValue(payload, jsonRoot, candidate)) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    missing.add(trimmed);
                }
            } else if (!hasRequiredFieldWithValue(payload, jsonRoot, trimmed)) {
                missing.add(trimmed);
            }
        }
        return missing;
    }

    private static JsonNode parseJsonPayload(String payload) {
        if (!OrcaApiProxySupport.isJsonPayload(payload)) {
            return null;
        }
        try {
            return JSON.readTree(payload);
        } catch (IOException ex) {
            return null;
        }
    }

    private static boolean hasRequiredFieldWithValue(String payload, JsonNode jsonRoot, String fieldName) {
        if (fieldName == null || fieldName.isBlank()) {
            return false;
        }
        if (jsonRoot != null) {
            return hasJsonFieldWithValue(jsonRoot, fieldName);
        }
        return hasXmlTagWithValue(payload, fieldName);
    }

    private static boolean hasJsonFieldWithValue(JsonNode node, String fieldName) {
        if (node == null || fieldName == null || fieldName.isBlank()) {
            return false;
        }
        if (node.isObject()) {
            java.util.Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                JsonNode value = entry.getValue();
                if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(fieldName)
                        && hasJsonValue(value)) {
                    return true;
                }
                if (hasJsonFieldWithValue(value, fieldName)) {
                    return true;
                }
            }
            return false;
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                if (hasJsonFieldWithValue(child, fieldName)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean hasJsonValue(JsonNode value) {
        if (value == null || value.isNull()) {
            return false;
        }
        if (value.isTextual()) {
            return !value.asText().isBlank();
        }
        if (value.isArray() || value.isObject()) {
            return value.size() > 0;
        }
        return true;
    }

    private static boolean hasXmlTagWithValue(String payload, String tag) {
        if (payload == null || payload.isBlank() || tag == null || tag.isBlank()) {
            return false;
        }
        String patternText = "<" + Pattern.quote(tag) + "(\\s[^>]*)?>(.*?)</" + Pattern.quote(tag) + ">";
        Pattern pattern = Pattern.compile(patternText, Pattern.DOTALL);
        Matcher matcher = pattern.matcher(payload);
        while (matcher.find()) {
            String content = matcher.group(2);
            if (content != null && !content.trim().isEmpty()) {
                return true;
            }
        }
        return false;
    }

    private static String extractQueryFromMeta(OrcaEndpoint endpoint, String payload) {
        if (endpoint == null || !endpoint.usesQueryFromMeta()) {
            return null;
        }
        if (payload == null || payload.isBlank()) {
            return null;
        }
        int start = payload.indexOf("<!--");
        if (start < 0) {
            return null;
        }
        int metaIndex = payload.indexOf("orca-meta:", start);
        if (metaIndex < 0) {
            return null;
        }
        int end = payload.indexOf("-->", metaIndex);
        if (end < 0) {
            return null;
        }
        String content = payload.substring(metaIndex + "orca-meta:".length(), end).trim();
        String[] parts = content.split("\\s+");
        for (String part : parts) {
            if (part.startsWith("query=")) {
                return part.substring("query=".length());
            }
        }
        return null;
    }

}

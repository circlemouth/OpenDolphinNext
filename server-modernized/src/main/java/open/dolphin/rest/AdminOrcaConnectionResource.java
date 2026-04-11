package open.dolphin.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.orca.config.OrcaConnectionConfigRecord;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.orca.transport.OrcaConnectionPolicyException;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.security.auth.AdminStepUpGuard;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;
import org.jboss.resteasy.plugins.providers.multipart.InputPart;
import org.jboss.resteasy.plugins.providers.multipart.MultipartFormDataInput;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Admin-only WebORCA / ORCA connection configuration API.
 *
 * <p>Secrets are never returned in responses.</p>
 */
@Path("/admin/orca/connection")
public class AdminOrcaConnectionResource extends AbstractResource {

    private static final Logger LOGGER = LoggerFactory.getLogger(AdminOrcaConnectionResource.class);

    private static final long MAX_CONFIG_BYTES = 256 * 1024; // 256KiB
    private static final long MAX_P12_BYTES = 10L * 1024L * 1024L; // 10MiB
    private static final long MAX_CA_BYTES = 2L * 1024L * 1024L; // 2MiB

    @Inject
    private OrcaConnectionConfigStore orcaConnectionConfigStore;

    @Inject
    private RestOrcaTransport restOrcaTransport;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    private AdminStepUpGuard adminStepUpGuard;

    private final ObjectMapper mapper = getSerializeMapper();

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getConfig(@Context HttpServletRequest request) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        String facilityId = resolveActorFacilityId(actor);
        OrcaConnectionConfigStore store = requireOrcaConnectionConfigStore();
        OrcaConnectionConfigRecord record = store.getSnapshot(facilityId);
        String defaultFacilityId = store.getDefaultFacilityId();
        Map<String, Object> body = buildView(record, runId, resolveTraceId(request), facilityId, defaultFacilityId);
        return Response.ok(body).header("x-run-id", runId).build();
    }

    @PUT
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    public Response putConfig(@Context HttpServletRequest request, MultipartFormDataInput input) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        adminStepUpGuard.require(request, "admin:mutation");
        String facilityId = resolveActorFacilityId(actor);
        OrcaConnectionConfigStore store = requireOrcaConnectionConfigStore();
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("operation", "save");
        details.put("resource", "/api/admin/orca/connection");
        details.put("runId", runId);
        details.put("actor", actor);
        details.put("facilityId", facilityId);

        OrcaConnectionConfigStore.UpdateRequest update;
        OrcaConnectionConfigStore.UploadedBinary p12;
        OrcaConnectionConfigStore.UploadedBinary ca;
        try {
            update = parseUpdateRequest(request, input);
            p12 = extractBinary(request, input, "clientCertificate", MAX_P12_BYTES);
            ca = extractBinary(request, input, "caCertificate", MAX_CA_BYTES);
        } catch (jakarta.ws.rs.WebApplicationException ex) {
            details.put("status", "failed");
            details.put("error", "invalid_request");
            details.put("httpStatus", ex.getResponse() != null ? ex.getResponse().getStatus() : null);
            recordAudit(request, "ADMIN_ORCA_CONNECTION_SAVE", details,
                    AuditEventEnvelope.Outcome.FAILURE, "orca.connection.invalid_request", "接続設定の入力が不正です。");
            throw ex;
        }

        OrcaConnectionConfigRecord updated;
        try {
            updated = store.update(facilityId, update, p12, ca, runId, actor);
        } catch (IllegalArgumentException ex) {
            details.put("status", "failed");
            details.put("error", ex.getMessage());
            recordAudit(request, "ADMIN_ORCA_CONNECTION_SAVE", details,
                    AuditEventEnvelope.Outcome.FAILURE, "orca.connection.invalid_request", ex.getMessage());
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", ex.getMessage());
        } catch (IllegalStateException ex) {
            details.put("status", "failed");
            details.put("error", ex.getMessage());
            recordAudit(request, "ADMIN_ORCA_CONNECTION_SAVE", details,
                    AuditEventEnvelope.Outcome.FAILURE, "orca.connection.persist_failed", ex.getMessage());
            throw restError(request, Response.Status.INTERNAL_SERVER_ERROR,
                    "persist_failed", "接続設定の永続化に失敗しました。サーバー設定を確認してください。");
        }

        // Apply immediately.
        String auditSummary = null;
        try {
            if (restOrcaTransport != null) {
                var settings = restOrcaTransport.reloadSettings(facilityId);
                auditSummary = settings != null ? settings.auditSummary() : null;
            }
        } catch (RuntimeException ex) {
            // Keep config saved even if transport reload fails (e.g. transient TLS provider issue).
            auditSummary = "reload_failed";
        }

        details.put("useWeborca", Boolean.TRUE.equals(updated.getUseWeborca()));
        details.put("pushConfigured", updated.getPushUrl() != null && !updated.getPushUrl().isBlank());
        details.put("clientAuthEnabled", Boolean.TRUE.equals(updated.getClientAuthEnabled()));
        details.put("clientCertificateUpdated", p12 != null);
        details.put("caCertificateUpdated", ca != null);
        if (auditSummary != null) {
            details.put("auditSummary", auditSummary);
        }
        recordAudit(request, "ADMIN_ORCA_CONNECTION_SAVE", details, AuditEventEnvelope.Outcome.SUCCESS, null, null);

        String defaultFacilityId = store.getDefaultFacilityId();
        Map<String, Object> body = buildView(updated, runId, resolveTraceId(request), facilityId, defaultFacilityId);
        if (auditSummary != null) {
            body.put("auditSummary", auditSummary);
        }
        return Response.ok(body).header("x-run-id", runId).build();
    }

    @PUT
    @Path("/default-facility")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response putDefaultFacility(@Context HttpServletRequest request, String payloadJson) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        adminStepUpGuard.require(request, "admin:mutation");
        String traceId = resolveTraceId(request);
        OrcaConnectionConfigStore store = requireOrcaConnectionConfigStore();

        String requestedDefaultFacilityId;
        try {
            requestedDefaultFacilityId = parseDefaultFacilityId(request, payloadJson);
        } catch (jakarta.ws.rs.WebApplicationException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "defaultFacilityId の解析に失敗しました。");
        }

        String updatedDefaultFacilityId;
        try {
            updatedDefaultFacilityId = store.updateDefaultFacilityId(requestedDefaultFacilityId, runId, actor);
        } catch (OrcaConnectionPolicyException ex) {
            throw restError(request, Response.Status.BAD_REQUEST, ex.getErrorCategory(), "指定した施設の ORCA 接続設定がありません。");
        } catch (IllegalStateException ex) {
            throw restError(request, Response.Status.INTERNAL_SERVER_ERROR,
                    "persist_failed", "接続設定の永続化に失敗しました。サーバー設定を確認してください。");
        }

        if (restOrcaTransport != null) {
            try {
                restOrcaTransport.reloadSettings(updatedDefaultFacilityId);
            } catch (RuntimeException ex) {
                LOGGER.debug("Failed to reload ORCA transport after default facility update", ex);
            }
        }

        OrcaConnectionConfigRecord record = store.getSnapshot(updatedDefaultFacilityId);
        Map<String, Object> body = buildView(record, runId, traceId, updatedDefaultFacilityId, updatedDefaultFacilityId);
        return Response.ok(body).header("x-run-id", runId).build();
    }

    @POST
    @Path("/test")
    @Produces(MediaType.APPLICATION_JSON)
    public Response testConnection(@Context HttpServletRequest request) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        requireAdminActor(request, runId);
        adminStepUpGuard.require(request, "admin:mutation");
        return new AdminOrcaConnectionTestSupport(
                request,
                orcaConnectionConfigStore,
                restOrcaTransport,
                userServiceBean,
                sessionAuditDispatcher
        ).testConnection();
    }

    private Map<String, Object> buildView(OrcaConnectionConfigRecord record,
                                          String runId,
                                          String traceId,
                                          String facilityId,
                                          String defaultFacilityId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("facilityId", facilityId);
        body.put("defaultFacilityId", defaultFacilityId);
        if (traceId != null && !traceId.isBlank()) {
            body.put("traceId", traceId);
        }
        if (record == null) {
            body.put("ok", false);
            body.put("error", "config_not_available");
            return body;
        }
        body.put("ok", true);
        body.put("useWeborca", Boolean.TRUE.equals(record.getUseWeborca()));
        body.put("serverUrl", record.getServerUrl());
        body.put("port", record.getPort());
        body.put("username", record.getUsername());
        body.put("pushUrl", record.getPushUrl());
        body.put("pushTenantId", record.getPushTenantId());
        body.put("pushConfigured", record.getPushUrl() != null && !record.getPushUrl().isBlank());
        body.put("pushTenantConfigured", record.getPushTenantId() != null && !record.getPushTenantId().isBlank());
        body.put("passwordConfigured", record.getPasswordEncrypted() != null && !record.getPasswordEncrypted().isBlank());
        body.put("passwordUpdatedAt", record.getPasswordUpdatedAt());
        body.put("clientAuthEnabled", Boolean.TRUE.equals(record.getClientAuthEnabled()));
        body.put("clientCertificateConfigured",
                record.getClientCertificateP12Encrypted() != null && !record.getClientCertificateP12Encrypted().isBlank());
        body.put("clientCertificateFileName", record.getClientCertificateFileName());
        body.put("clientCertificateUploadedAt", record.getClientCertificateUploadedAt());
        body.put("clientCertificatePassphraseConfigured",
                record.getClientCertificatePassphraseEncrypted() != null && !record.getClientCertificatePassphraseEncrypted().isBlank());
        body.put("clientCertificatePassphraseUpdatedAt", record.getClientCertificatePassphraseUpdatedAt());
        body.put("caCertificateConfigured",
                record.getCaCertificateEncrypted() != null && !record.getCaCertificateEncrypted().isBlank());
        body.put("caCertificateFileName", record.getCaCertificateFileName());
        body.put("caCertificateUploadedAt", record.getCaCertificateUploadedAt());
        body.put("updatedAt", record.getUpdatedAt());
        if (restOrcaTransport != null) {
            body.put("auditSummary", restOrcaTransport.auditSummary(facilityId));
        }
        return body;
    }

    private String parseDefaultFacilityId(HttpServletRequest request, String payloadJson) {
        if (payloadJson == null || payloadJson.isBlank()) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "defaultFacilityId が必要です。");
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = mapper.readValue(payloadJson, Map.class);
            String defaultFacilityId = trimToNull(asString(payload.get("defaultFacilityId")));
            if (defaultFacilityId == null) {
                throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "defaultFacilityId が必要です。");
            }
            return defaultFacilityId;
        } catch (jakarta.ws.rs.WebApplicationException ex) {
            throw ex;
        } catch (Exception ex) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "defaultFacilityId のJSON解析に失敗しました。");
        }
    }

    private OrcaConnectionConfigStore.UpdateRequest parseUpdateRequest(HttpServletRequest request, MultipartFormDataInput input) {
        if (input == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "multipart/form-data が必要です。");
        }
        String configJson = readTextPart(request, input, "config", MAX_CONFIG_BYTES);
        if (configJson == null || configJson.isBlank()) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "config が必要です。");
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = mapper.readValue(configJson, Map.class);
            Boolean useWeborca = asBoolean(payload.get("useWeborca")).orElse(null);
            String serverUrl = trimToNull(asString(payload.get("serverUrl")));
            Integer port = asInteger(payload.get("port"));
            String username = trimToNull(asString(payload.get("username")));
            String pushUrl = payload.containsKey("pushUrl") ? asString(payload.get("pushUrl")) : null;
            String pushTenantId = payload.containsKey("pushTenantId") ? asString(payload.get("pushTenantId")) : null;
            String password = trimToNull(asString(payload.get("password")));
            Boolean clientAuthEnabled = asBoolean(payload.get("clientAuthEnabled")).orElse(null);
            String passphrase = trimToNull(asString(payload.get("clientCertificatePassphrase")));
            return new OrcaConnectionConfigStore.UpdateRequest(
                    useWeborca,
                    serverUrl,
                    port,
                    username,
                    pushUrl,
                    pushTenantId,
                    password,
                    clientAuthEnabled,
                    passphrase
            );
        } catch (IOException ex) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "config のJSON解析に失敗しました。");
        }
    }

    private OrcaConnectionConfigStore.UploadedBinary extractBinary(HttpServletRequest request,
                                                                   MultipartFormDataInput input,
                                                                   String key,
                                                                   long maxBytes) {
        if (input == null || key == null) {
            return null;
        }
        Map<String, List<InputPart>> map = input.getFormDataMap();
        if (map == null) {
            return null;
        }
        List<InputPart> parts = map.get(key);
        if (parts == null || parts.isEmpty()) {
            return null;
        }
        InputPart part = parts.get(0);
        try {
            String fileName = safeFileName(fileNameFromPart(part), key + ".bin");
            byte[] bytes = readBytesWithLimit(part, maxBytes);
            if (bytes == null || bytes.length == 0) {
                return null;
            }
            return new OrcaConnectionConfigStore.UploadedBinary(fileName, bytes);
        } catch (RuntimeException ex) {
            throw ex;
        } catch (Exception ex) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_multipart", key + " の読み込みに失敗しました。");
        }
    }

    private String readTextPart(HttpServletRequest request, MultipartFormDataInput input, String key, long maxBytes) {
        if (input == null || key == null) {
            return null;
        }
        Map<String, List<InputPart>> map = input.getFormDataMap();
        if (map == null) {
            return null;
        }
        List<InputPart> parts = map.get(key);
        if (parts == null || parts.isEmpty()) {
            return null;
        }
        InputPart part = parts.get(0);
        try {
            byte[] bytes = readBytesWithLimit(part, maxBytes);
            if (bytes == null || bytes.length == 0) {
                return null;
            }
            return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
        } catch (RuntimeException ex) {
            throw ex;
        } catch (Exception ex) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_multipart", key + " の読み込みに失敗しました。");
        }
    }

    private byte[] readBytesWithLimit(InputPart part, long maxBytes) throws Exception {
        long limit = maxBytes > 0 ? maxBytes : 1024 * 1024;
        try (InputStream in = part.getBody(InputStream.class, null)) {
            if (in == null) {
                return null;
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            long total = 0;
            int n;
            while ((n = in.read(buf)) >= 0) {
                if (n == 0) {
                    continue;
                }
                total += n;
                if (total > limit) {
                    throw restError(null, Response.Status.REQUEST_ENTITY_TOO_LARGE,
                            "payload_too_large", "Payload too large",
                            Map.of("maxBytes", limit, "size", total, "field", "multipart"), null);
                }
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        }
    }

    private String fileNameFromPart(InputPart part) {
        if (part == null || part.getHeaders() == null) {
            return null;
        }
        List<String> cd = part.getHeaders().get("Content-Disposition");
        if (cd == null || cd.isEmpty()) {
            return null;
        }
        String raw = cd.get(0);
        if (raw == null) {
            return null;
        }
        for (String token : raw.split(";")) {
            String t = token != null ? token.trim() : "";
            if (t.startsWith("filename=")) {
                String v = t.substring("filename=".length()).trim();
                if (v.startsWith("\"") && v.endsWith("\"") && v.length() >= 2) {
                    v = v.substring(1, v.length() - 1);
                }
                return v;
            }
        }
        return null;
    }

    private String safeFileName(String original, String fallback) {
        String name = original;
        if (name == null || name.isBlank()) {
            name = fallback;
        }
        return name.replace("\"", "_").replace("\r", "").replace("\n", "");
    }

    private String requireAdminActor(HttpServletRequest request, String runId) {
        String actor = request != null ? request.getRemoteUser() : null;
        if (actor == null || actor.isBlank()) {
            throw restError(request, Response.Status.UNAUTHORIZED, "unauthorized", "Authentication required");
        }
        if (userServiceBean == null || !userServiceBean.isAdmin(actor)) {
            throw restError(request, Response.Status.FORBIDDEN, "forbidden", "管理者権限が必要です。");
        }
        return actor;
    }

    private String resolveActorFacilityId(String actor) {
        if (actor == null || actor.isBlank()) {
            return null;
        }
        int idx = actor.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (idx <= 0) {
            return null;
        }
        String facility = actor.substring(0, idx).trim();
        return facility.isEmpty() ? null : facility;
    }

    private void recordAudit(HttpServletRequest request,
                             String action,
                             Map<String, Object> details,
                             AuditEventEnvelope.Outcome outcome,
                             String errorCode,
                             String errorMessage) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction(action);
        payload.setResource(request != null ? request.getRequestURI() : "/api/admin/orca/connection");
        payload.setActorId(request != null ? request.getRemoteUser() : null);
        payload.setIpAddress(request != null ? request.getRemoteAddr() : null);
        payload.setUserAgent(request != null ? request.getHeader("User-Agent") : null);
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            payload.setTraceId(traceId);
        }
        String requestId = request != null ? request.getHeader("X-Request-Id") : null;
        if (requestId != null && !requestId.isBlank()) {
            payload.setRequestId(requestId.trim());
        } else if (traceId != null && !traceId.isBlank()) {
            payload.setRequestId(traceId);
        }
        payload.setDetails(details);
        sessionAuditDispatcher.record(payload, outcome, errorCode, errorMessage);
    }

    private static Optional<Boolean> asBoolean(Object value) {
        if (value instanceof Boolean b) {
            return Optional.of(b);
        }
        if (value instanceof Number n) {
            return Optional.of(n.intValue() != 0);
        }
        if (value instanceof String s) {
            String normalized = s.trim().toLowerCase(Locale.ROOT);
            if ("true".equals(normalized) || "1".equals(normalized) || "yes".equals(normalized) || "on".equals(normalized)) {
                return Optional.of(Boolean.TRUE);
            }
            if ("false".equals(normalized) || "0".equals(normalized) || "no".equals(normalized) || "off".equals(normalized)) {
                return Optional.of(Boolean.FALSE);
            }
        }
        return Optional.empty();
    }

    private static Integer asInteger(Object value) {
        if (value instanceof Number n) {
            return n.intValue();
        }
        if (value instanceof String s) {
            try {
                return Integer.parseInt(s.trim());
            } catch (Exception ex) {
                return null;
            }
        }
        return null;
    }

    private static String asString(Object value) {
        if (value == null) {
            return null;
        }
        return value instanceof String s ? s : String.valueOf(value);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private OrcaConnectionConfigStore requireOrcaConnectionConfigStore() {
        return Objects.requireNonNull(orcaConnectionConfigStore, "orcaConnectionConfigStore");
    }
}

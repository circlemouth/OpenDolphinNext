package open.dolphin.rest;

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
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.rest.admin.AdminConfigSnapshot;
import open.dolphin.rest.admin.AdminConfigStore;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;

@Path("/admin")
public class AdminConfigResource extends AbstractResource {

    @Inject
    private AdminConfigStore adminConfigStore;

    @Inject
    private open.dolphin.orca.transport.RestOrcaTransport restOrcaTransport;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    private UserServiceBean userServiceBean;

    @GET
    @Path("/config")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getConfig(@Context HttpServletRequest request) {
        requireAdmin(request, userServiceBean);
        AdminConfigSnapshot snapshot = resolveSnapshot();
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        return buildResponse(snapshot, runId);
    }

    @PUT
    @Path("/config")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response putConfig(@Context HttpServletRequest request, Map<String, Object> payload) {
        requireAdmin(request, userServiceBean);
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = request != null ? request.getRemoteUser() : null;
        String facilityId = resolveActorFacilityId(actor);
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("operation", "adminConfigUpdate");
        details.put("resource", "/api/admin/config");
        details.put("runId", runId);
        details.put("actor", actor);
        details.put("facilityId", facilityId);
        details.put("changedKeys", payload != null ? payload.keySet() : List.of());

        try {
            validatePayload(payload);
            AdminConfigSnapshot incoming = toSnapshot(payload);
            AdminConfigSnapshot updated = adminConfigStore.updateFromPayload(incoming, runId);
            details.put("status", "success");
            details.put("deliveryMode", updated.getDeliveryMode());
            details.put("chartsMasterSource", updated.getChartsMasterSource());
            recordAudit(request, "ADMIN_CONFIG_UPDATE", "/api/admin/config", details, AuditEventEnvelope.Outcome.SUCCESS, null, null);
            return buildResponse(updated, runId);
        } catch (IllegalArgumentException ex) {
            details.put("status", "failed");
            details.put("error", ex.getMessage());
            recordAudit(request, "ADMIN_CONFIG_UPDATE", "/api/admin/config", details,
                    AuditEventEnvelope.Outcome.FAILURE, "admin.config.invalid", ex.getMessage());
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", ex.getMessage());
        } catch (RuntimeException ex) {
            details.put("status", "failed");
            details.put("error", ex.getMessage());
            recordAudit(request, "ADMIN_CONFIG_UPDATE", "/api/admin/config", details,
                    AuditEventEnvelope.Outcome.FAILURE, "admin.config.persist_failed", ex.getMessage());
            throw ex;
        }
    }

    @POST
    @Path("/orca/transport/reload")
    @Produces(MediaType.APPLICATION_JSON)
    public Response reloadOrcaTransport(@Context HttpServletRequest request) {
        requireAdmin(request, userServiceBean);
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("operation", "orcaTransportReload");
        details.put("resource", "/api/admin/orca/transport/reload");
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            details.put("traceId", traceId);
        }
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        details.put("runId", runId);
        String remoteUser = request != null ? request.getRemoteUser() : null;
        details.put("remoteUser", remoteUser);
        try {
            var settings = restOrcaTransport.reloadSettings();
            String summary = settings != null ? settings.auditSummary() : "unknown";
            details.put("auditSummary", summary);
            details.put("status", "success");
            recordAudit(request, "ORCA_TRANSPORT_RELOAD", "/api/admin/orca/transport/reload",
                    details, AuditEventEnvelope.Outcome.SUCCESS, null, null);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("runId", runId);
            body.put("auditSummary", summary);
            body.put("reloaded", true);
            return Response.ok(body)
                    .header("x-run-id", runId)
                    .header("x-orca-transport", summary)
                    .build();
        } catch (RuntimeException ex) {
            details.put("status", "failed");
            details.put("error", ex.getMessage());
            recordAudit(request, "ORCA_TRANSPORT_RELOAD", "/api/admin/orca/transport/reload",
                    details, AuditEventEnvelope.Outcome.FAILURE, "orca.transport.reload.error", ex.getMessage());
            throw ex;
        }
    }

    private void recordAudit(HttpServletRequest request, String action, String resource, Map<String, Object> details,
            AuditEventEnvelope.Outcome outcome, String errorCode, String errorMessage) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction(action);
        payload.setResource(resource);
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
        payload.setDetails(details);
        sessionAuditDispatcher.record(payload, outcome, errorCode, errorMessage);
    }

    private void validatePayload(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            throw new IllegalArgumentException("設定内容が空です。");
        }
        String endpoint = getString(payload, "orcaEndpoint", "endpoint");
        if (endpoint != null) {
            validateEndpoint(endpoint);
        }
        String chartsMasterSource = getString(payload, "chartsMasterSource");
        if (chartsMasterSource != null) {
            String normalized = chartsMasterSource.trim().toLowerCase(Locale.ROOT);
            if (!List.of("auto", "orca", "local").contains(normalized)) {
                throw new IllegalArgumentException("chartsMasterSource は auto/orca/local のいずれかを指定してください。");
            }
        }
        String deliveryMode = getString(payload, "deliveryMode", "deliveryState", "deliveryStatus");
        if (deliveryMode != null) {
            String normalized = deliveryMode.trim().toLowerCase(Locale.ROOT);
            if (!List.of("manual", "auto").contains(normalized)) {
                throw new IllegalArgumentException("deliveryMode は manual/auto のいずれかを指定してください。");
            }
        }
        String environment = getString(payload, "environment", "env", "stage");
        if (environment != null && environment.trim().length() > 32) {
            throw new IllegalArgumentException("environment は32文字以内で指定してください。");
        }
        String note = getString(payload, "note");
        if (note != null && note.length() > 2000) {
            throw new IllegalArgumentException("note が長すぎます。2000文字以内で指定してください。");
        }
    }

    private void validateEndpoint(String endpoint) {
        try {
            URI uri = URI.create(endpoint.trim());
            String scheme = uri.getScheme();
            if (scheme == null || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))) {
                throw new IllegalArgumentException("orcaEndpoint は http/https URL を指定してください。");
            }
            if (uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalArgumentException("orcaEndpoint のホスト名が不正です。");
            }
        } catch (IllegalArgumentException ex) {
            if (ex.getMessage() != null && ex.getMessage().contains("orcaEndpoint")) {
                throw ex;
            }
            throw new IllegalArgumentException("orcaEndpoint が不正です。", ex);
        }
    }

    private String resolveActorFacilityId(String actor) {
        if (actor == null || actor.isBlank()) {
            return null;
        }
        int idx = actor.indexOf(':');
        if (idx > 0) {
            return actor.substring(0, idx);
        }
        return actor;
    }

    @GET
    @Path("/delivery")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getDelivery(@Context HttpServletRequest request) {
        requireAdmin(request, userServiceBean);
        AdminConfigSnapshot snapshot = resolveSnapshot();
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        return buildResponse(snapshot, runId);
    }

    private AdminConfigSnapshot resolveSnapshot() {
        return adminConfigStore.getSnapshot();
    }

    private Response buildResponse(AdminConfigSnapshot snapshot, String runId) {
        Map<String, Object> body = toResponse(snapshot, runId);
        Response.ResponseBuilder builder = Response.ok(body);
        builder.header("x-run-id", runId);
        builder.header("x-admin-delivery-verification", Boolean.TRUE.equals(snapshot.getVerified()) ? "enabled" : "disabled");
        builder.header("x-orca-queue-mode", Boolean.TRUE.equals(snapshot.getUseMockOrcaQueue()) ? "mock" : "live");
        if (snapshot.getEnvironment() != null) {
            builder.header("x-environment", snapshot.getEnvironment());
        }
        if (snapshot.getDeliveryMode() != null) {
            builder.header("x-delivery-mode", snapshot.getDeliveryMode());
            builder.header("x-admin-delivery-mode", snapshot.getDeliveryMode());
        }
        if (snapshot.getDeliveryEtag() != null && !snapshot.getDeliveryEtag().isBlank()) {
            builder.header("etag", snapshot.getDeliveryEtag());
            builder.header("x-delivery-etag", snapshot.getDeliveryEtag());
        }
        return builder.build();
    }

    private Map<String, Object> toResponse(AdminConfigSnapshot snapshot, String runId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("orcaEndpoint", snapshot.getOrcaEndpoint());
        body.put("mswEnabled", snapshot.getMswEnabled());
        body.put("useMockOrcaQueue", snapshot.getUseMockOrcaQueue());
        body.put("verifyAdminDelivery", snapshot.getVerifyAdminDelivery());
        body.put("chartsDisplayEnabled", snapshot.getChartsDisplayEnabled());
        body.put("chartsSendEnabled", snapshot.getChartsSendEnabled());
        body.put("chartsMasterSource", snapshot.getChartsMasterSource());
        Map<String, Object> charts = new LinkedHashMap<>();
        charts.put("displayEnabled", snapshot.getChartsDisplayEnabled());
        charts.put("sendEnabled", snapshot.getChartsSendEnabled());
        charts.put("masterSource", snapshot.getChartsMasterSource());
        body.put("charts", charts);
        body.put("deliveryId", snapshot.getDeliveryId());
        body.put("deliveryVersion", snapshot.getDeliveryVersion());
        body.put("deliveryEtag", snapshot.getDeliveryEtag());
        body.put("deliveredAt", snapshot.getDeliveredAt());
        body.put("note", snapshot.getNote());
        body.put("environment", snapshot.getEnvironment());
        body.put("deliveryMode", snapshot.getDeliveryMode());
        body.put("source", snapshot.getSource());
        body.put("verified", snapshot.getVerified());
        return body;
    }

    private AdminConfigSnapshot toSnapshot(Map<String, Object> payload) {
        AdminConfigSnapshot snapshot = new AdminConfigSnapshot();
        if (payload == null) {
            return snapshot;
        }
        snapshot.setOrcaEndpoint(getString(payload, "orcaEndpoint", "endpoint"));
        snapshot.setMswEnabled(getBoolean(payload.get("mswEnabled"), payload.get("msw")));
        snapshot.setUseMockOrcaQueue(getBoolean(payload.get("useMockOrcaQueue")));
        snapshot.setVerifyAdminDelivery(getBoolean(payload.get("verifyAdminDelivery")));
        snapshot.setChartsDisplayEnabled(getBoolean(payload.get("chartsDisplayEnabled")));
        snapshot.setChartsSendEnabled(getBoolean(payload.get("chartsSendEnabled")));
        snapshot.setChartsMasterSource(getString(payload, "chartsMasterSource"));
        snapshot.setNote(getString(payload, "note"));
        snapshot.setEnvironment(getString(payload, "environment", "env", "stage"));
        snapshot.setDeliveryMode(getString(payload, "deliveryMode", "deliveryState", "deliveryStatus"));

        Object charts = payload.get("charts");
        if (charts instanceof Map<?, ?> map) {
            Object display = map.get("displayEnabled");
            Object send = map.get("sendEnabled");
            Object master = map.get("masterSource");
            if (snapshot.getChartsDisplayEnabled() == null) snapshot.setChartsDisplayEnabled(getBoolean(display));
            if (snapshot.getChartsSendEnabled() == null) snapshot.setChartsSendEnabled(getBoolean(send));
            if (snapshot.getChartsMasterSource() == null) snapshot.setChartsMasterSource(getString(master));
        }
        return snapshot;
    }

    private String getString(Map<String, Object> payload, String... keys) {
        if (payload == null || keys == null) return null;
        for (String key : keys) {
            Object value = payload.get(key);
            if (value instanceof String text && !text.isBlank()) {
                return text;
            }
        }
        return null;
    }

    private String getString(Object value) {
        if (value instanceof String text && !text.isBlank()) {
            return text;
        }
        return null;
    }

    private Boolean getBoolean(Object... values) {
        if (values == null) return null;
        for (Object value : values) {
            Boolean parsed = getBoolean(value);
            if (parsed != null) {
                return parsed;
            }
        }
        return null;
    }

    private Boolean getBoolean(Object value) {
        if (value instanceof Boolean bool) return bool;
        if (value instanceof String text) {
            if ("true".equalsIgnoreCase(text) || "1".equals(text)) return Boolean.TRUE;
            if ("false".equalsIgnoreCase(text) || "0".equals(text)) return Boolean.FALSE;
        }
        return null;
    }

}

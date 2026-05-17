package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.rest.masterupdate.MasterVisibilityStore;
import open.dolphin.rest.masterupdate.MasterUpdateService;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.security.auth.AdminStepUpGuard;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;
import org.jboss.resteasy.plugins.providers.multipart.InputPart;
import org.jboss.resteasy.plugins.providers.multipart.MultipartFormDataInput;

/**
 * Administration API for master update operations.
 */
@Path("/admin/master-updates")
public class AdminMasterUpdateResource extends AbstractResource {

    private static final long MAX_UPLOAD_BYTES = 100L * 1024L * 1024L;

    @Inject
    private MasterUpdateService masterUpdateService;

    @Inject
    private MasterVisibilityStore masterVisibilityStore;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    private AdminStepUpGuard adminStepUpGuard;

    @GET
    @Path("/datasets")
    @Produces(MediaType.APPLICATION_JSON)
    public Response listDatasets(@Context HttpServletRequest request) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        Map<String, Object> body = masterUpdateService.listDatasets(runId);
        recordAudit(request, "MASTER_UPDATE_LIST", actor, runId,
                Map.of("resource", "/api/admin/master-updates/datasets", "status", "success"),
                AuditEventEnvelope.Outcome.SUCCESS, null, null);
        return Response.ok(body).header("x-run-id", runId).build();
    }

    @GET
    @Path("/visibility")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getVisibility(@Context HttpServletRequest request) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAuthenticatedActor(request);
        Map<String, Object> body = masterVisibilityStore.getVisibility(runId);
        recordAudit(request, "MASTER_VISIBILITY_GET", actor, runId,
                Map.of("resource", "/api/admin/master-updates/visibility", "status", "success"),
                AuditEventEnvelope.Outcome.SUCCESS, null, null);
        return Response.ok(body).header("x-run-id", runId).build();
    }

    @PUT
    @Path("/visibility")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response updateVisibility(@Context HttpServletRequest request,
                                     Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        adminStepUpGuard.require(request, "admin:mutation");
        try {
            MasterVisibilityStore.UpdateResult result = masterVisibilityStore.updateVisibility(payload, actor, runId);
            recordAudit(request, "MASTER_VISIBILITY_PUT", actor, runId,
                    Map.of(
                            "resource", "/api/admin/master-updates/visibility",
                            "status", "success",
                            "changedCategories", result.changedCategories()
                    ),
                    AuditEventEnvelope.Outcome.SUCCESS, null, null);
            return Response.ok(result.body()).header("x-run-id", runId).build();
        } catch (MasterUpdateService.MasterUpdateException ex) {
            recordAudit(request, "MASTER_VISIBILITY_PUT", actor, runId,
                    Map.of("resource", "/api/admin/master-updates/visibility", "status", "failed"),
                    AuditEventEnvelope.Outcome.FAILURE, ex.getCode(), ex.getMessage());
            throw restError(request, Response.Status.fromStatusCode(ex.getStatusCode()), ex.getCode(), ex.getMessage());
        }
    }

    @GET
    @Path("/datasets/{datasetCode}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getDatasetDetail(@Context HttpServletRequest request,
                                     @PathParam("datasetCode") String datasetCode) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        try {
            Map<String, Object> body = masterUpdateService.getDatasetDetail(datasetCode, runId);
            recordAudit(request, "MASTER_UPDATE_DETAIL", actor, runId,
                    Map.of("datasetCode", datasetCode, "status", "success"),
                    AuditEventEnvelope.Outcome.SUCCESS, null, null);
            return Response.ok(body).header("x-run-id", runId).build();
        } catch (MasterUpdateService.MasterUpdateException ex) {
            recordAudit(request, "MASTER_UPDATE_DETAIL", actor, runId,
                    Map.of("datasetCode", datasetCode, "status", "failed"),
                    AuditEventEnvelope.Outcome.FAILURE, ex.getCode(), ex.getMessage());
            throw restError(request, Response.Status.fromStatusCode(ex.getStatusCode()), ex.getCode(), ex.getMessage());
        }
    }

    @POST
    @Path("/datasets/{datasetCode}/run")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response runDataset(@Context HttpServletRequest request,
                               @PathParam("datasetCode") String datasetCode,
                               Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        adminStepUpGuard.require(request, "admin:mutation");
        boolean force = payload != null && readBoolean(payload.get("force"));
        try {
            Map<String, Object> body = masterUpdateService.runDataset(datasetCode, "MANUAL", actor, runId, force);
            recordAudit(request, "MASTER_UPDATE_RUN", actor, runId,
                    Map.of("datasetCode", datasetCode, "force", force, "status", "success"),
                    AuditEventEnvelope.Outcome.SUCCESS, null, null);
            return Response.ok(body).header("x-run-id", runId).build();
        } catch (MasterUpdateService.MasterUpdateException ex) {
            recordAudit(request, "MASTER_UPDATE_RUN", actor, runId,
                    Map.of("datasetCode", datasetCode, "force", force, "status", "failed"),
                    AuditEventEnvelope.Outcome.FAILURE, ex.getCode(), ex.getMessage());
            throw restError(request, Response.Status.fromStatusCode(ex.getStatusCode()), ex.getCode(), ex.getMessage());
        }
    }

    @POST
    @Path("/datasets/{datasetCode}/rollback")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response rollbackDataset(@Context HttpServletRequest request,
                                    @PathParam("datasetCode") String datasetCode,
                                    Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        adminStepUpGuard.require(request, "admin:mutation");
        String versionId = payload != null && payload.get("versionId") instanceof String text ? text : null;
        Map<String, Object> rollbackAuditDetails = new LinkedHashMap<>();
        rollbackAuditDetails.put("datasetCode", datasetCode);
        rollbackAuditDetails.put("versionId", versionId);

        try {
            Map<String, Object> body = masterUpdateService.rollbackDataset(datasetCode, versionId, actor, runId);
            rollbackAuditDetails.put("status", "success");
            recordAudit(request, "MASTER_UPDATE_ROLLBACK", actor, runId,
                    rollbackAuditDetails,
                    AuditEventEnvelope.Outcome.SUCCESS, null, null);
            return Response.ok(body).header("x-run-id", runId).build();
        } catch (MasterUpdateService.MasterUpdateException ex) {
            rollbackAuditDetails.put("status", "failed");
            recordAudit(request, "MASTER_UPDATE_ROLLBACK", actor, runId,
                    rollbackAuditDetails,
                    AuditEventEnvelope.Outcome.FAILURE, ex.getCode(), ex.getMessage());
            throw restError(request, Response.Status.fromStatusCode(ex.getStatusCode()), ex.getCode(), ex.getMessage());
        }
    }

    @POST
    @Path("/datasets/{datasetCode}/upload")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    public Response uploadDataset(@Context HttpServletRequest request,
                                  @PathParam("datasetCode") String datasetCode,
                                  MultipartFormDataInput input) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        adminStepUpGuard.require(request, "admin:mutation");
        UploadedFile uploaded = extractUploadFile(request, input, "file", MAX_UPLOAD_BYTES);
        String previewHash = request != null ? request.getHeader("X-Master-Artifact-Preview-Hash") : null;

        try {
            Map<String, Object> body = masterUpdateService.uploadDataset(
                    datasetCode,
                    uploaded.fileName,
                    uploaded.payload,
                    previewHash,
                    actor,
                    runId
            );
            recordAudit(request, "MASTER_UPDATE_UPLOAD", actor, runId,
                    Map.of("datasetCode", datasetCode, "fileName", uploaded.fileName, "status", "success"),
                    AuditEventEnvelope.Outcome.SUCCESS, null, null);
            return Response.ok(body).header("x-run-id", runId).build();
        } catch (MasterUpdateService.MasterUpdateException ex) {
            recordAudit(request, "MASTER_UPDATE_UPLOAD", actor, runId,
                    Map.of("datasetCode", datasetCode, "fileName", uploaded.fileName, "status", "failed"),
                    AuditEventEnvelope.Outcome.FAILURE, ex.getCode(), ex.getMessage());
            throw restError(request, Response.Status.fromStatusCode(ex.getStatusCode()), ex.getCode(), ex.getMessage());
        }
    }

    @POST
    @Path("/datasets/{datasetCode}/upload/preview")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    public Response previewUploadDataset(@Context HttpServletRequest request,
                                         @PathParam("datasetCode") String datasetCode,
                                         MultipartFormDataInput input) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        adminStepUpGuard.require(request, "admin:mutation");
        UploadedFile uploaded = extractUploadFile(request, input, "file", MAX_UPLOAD_BYTES);

        try {
            Map<String, Object> body = masterUpdateService.previewDatasetUpload(
                    datasetCode,
                    uploaded.fileName,
                    uploaded.payload,
                    actor,
                    runId
            );
            recordAudit(request, "MASTER_UPDATE_UPLOAD_PREVIEW", actor, runId,
                    Map.of("datasetCode", datasetCode, "fileName", uploaded.fileName, "status", "success"),
                    AuditEventEnvelope.Outcome.SUCCESS, null, null);
            return Response.ok(body).header("x-run-id", runId).build();
        } catch (MasterUpdateService.MasterUpdateException ex) {
            recordAudit(request, "MASTER_UPDATE_UPLOAD_PREVIEW", actor, runId,
                    Map.of("datasetCode", datasetCode, "fileName", uploaded.fileName, "status", "failed"),
                    AuditEventEnvelope.Outcome.FAILURE, ex.getCode(), ex.getMessage());
            throw restError(request, Response.Status.fromStatusCode(ex.getStatusCode()), ex.getCode(), ex.getMessage());
        }
    }

    @GET
    @Path("/schedule")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getSchedule(@Context HttpServletRequest request) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        Map<String, Object> body = masterUpdateService.getSchedule(runId);
        recordAudit(request, "MASTER_UPDATE_SCHEDULE_GET", actor, runId,
                Map.of("status", "success"),
                AuditEventEnvelope.Outcome.SUCCESS, null, null);
        return Response.ok(body).header("x-run-id", runId).build();
    }

    @PUT
    @Path("/schedule")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response updateSchedule(@Context HttpServletRequest request,
                                   Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        adminStepUpGuard.require(request, "admin:mutation");
        try {
            Map<String, Object> body = masterUpdateService.updateSchedule(payload, actor, runId);
            recordAudit(request, "MASTER_UPDATE_SCHEDULE_PUT", actor, runId,
                    Map.of("status", "success"),
                    AuditEventEnvelope.Outcome.SUCCESS, null, null);
            return Response.ok(body).header("x-run-id", runId).build();
        } catch (MasterUpdateService.MasterUpdateException ex) {
            recordAudit(request, "MASTER_UPDATE_SCHEDULE_PUT", actor, runId,
                    Map.of("status", "failed"),
                    AuditEventEnvelope.Outcome.FAILURE, ex.getCode(), ex.getMessage());
            throw restError(request, Response.Status.fromStatusCode(ex.getStatusCode()), ex.getCode(), ex.getMessage());
        }
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

    private String requireAuthenticatedActor(HttpServletRequest request) {
        String actor = request != null ? request.getRemoteUser() : null;
        if (actor == null || actor.isBlank()) {
            throw restError(request, Response.Status.UNAUTHORIZED, "unauthorized", "Authentication required");
        }
        return actor;
    }

    private void recordAudit(HttpServletRequest request,
                             String action,
                             String actor,
                             String runId,
                             Map<String, Object> details,
                             AuditEventEnvelope.Outcome outcome,
                             String errorCode,
                             String errorMessage) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        payload.setAction(action);
        payload.setResource(request != null ? request.getRequestURI() : "/api/admin/master-updates");
        payload.setActorId(actor);
        payload.setIpAddress(request != null ? request.getRemoteAddr() : null);
        payload.setUserAgent(request != null ? request.getHeader("User-Agent") : null);
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            payload.setTraceId(traceId);
            payload.setRequestId(traceId);
        }
        Map<String, Object> merged = new LinkedHashMap<>();
        if (details != null) {
            merged.putAll(details);
        }
        merged.put("runId", runId);
        merged.put("timestamp", Instant.now().toString());
        payload.setDetails(merged);
        sessionAuditDispatcher.record(payload, outcome, errorCode, errorMessage);
    }

    private UploadedFile extractUploadFile(HttpServletRequest request,
                                           MultipartFormDataInput input,
                                           String key,
                                           long maxBytes) {
        if (input == null || key == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "multipart/form-data が必要です。");
        }
        Map<String, List<InputPart>> formData = input.getFormDataMap();
        if (formData == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "multipart/form-data が必要です。");
        }
        List<InputPart> parts = formData.get(key);
        if (parts == null || parts.isEmpty()) {
            throw restError(request, Response.Status.BAD_REQUEST, "file_required", "file フィールドが必要です。");
        }
        InputPart part = parts.get(0);
        try {
            byte[] payload = readBytesWithLimit(part, maxBytes);
            if (payload == null || payload.length == 0) {
                throw restError(request, Response.Status.BAD_REQUEST, "empty_upload", "アップロードファイルが空です。");
            }
            return new UploadedFile(safeFileName(fileNameFromPart(part), "dataset-upload.bin"), payload);
        } catch (RuntimeException ex) {
            throw ex;
        } catch (Exception ex) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_multipart", "アップロードファイルの読み込みに失敗しました。");
        }
    }

    private byte[] readBytesWithLimit(InputPart part, long maxBytes) throws Exception {
        long limit = maxBytes > 0 ? maxBytes : 10L * 1024L * 1024L;
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
                            "payload_too_large", "アップロードサイズが上限を超えました",
                            Map.of("maxBytes", limit, "size", total, "field", "file"), null);
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
                String value = t.substring("filename=".length()).trim();
                if (value.startsWith("\"") && value.endsWith("\"") && value.length() >= 2) {
                    value = value.substring(1, value.length() - 1);
                }
                return value;
            }
        }
        return null;
    }

    private String safeFileName(String original, String fallback) {
        String value = original;
        if (value == null || value.isBlank()) {
            value = fallback;
        }
        value = value.replace('\\', '/');
        int slash = value.lastIndexOf('/');
        if (slash >= 0) {
            value = slash + 1 < value.length() ? value.substring(slash + 1) : fallback;
        }
        StringBuilder sanitized = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (Character.isISOControl(ch)) {
                continue;
            }
            if (ch == '"' || ch == '\'' || ch == '\\' || ch == '/') {
                sanitized.append('_');
            } else {
                sanitized.append(ch);
            }
        }
        value = sanitized.toString().trim();
        if (value.isBlank()) {
            value = fallback;
        }
        byte[] bytes = value.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return bytes.length > 180 ? fallback : value;
    }

    private boolean readBoolean(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof String text) {
            String normalized = text.trim().toLowerCase();
            if ("1".equals(normalized) || "true".equals(normalized) || "on".equals(normalized)) {
                return true;
            }
            if ("0".equals(normalized) || "false".equals(normalized) || "off".equals(normalized)) {
                return false;
            }
        }
        return false;
    }

    private static final class UploadedFile {
        private final String fileName;
        private final byte[] payload;

        private UploadedFile(String fileName, byte[] payload) {
            this.fileName = fileName;
            this.payload = payload;
        }
    }
}

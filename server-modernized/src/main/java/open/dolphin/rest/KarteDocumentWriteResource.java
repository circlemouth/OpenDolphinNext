package open.dolphin.rest;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import open.dolphin.converter.StringListConverter;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.infomodel.StringList;
import open.dolphin.rest.support.LegacyJsonSupport;
import open.dolphin.security.audit.AuditDetailSanitizer;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PVTServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.session.framework.SessionTraceContext;
import open.dolphin.session.framework.SessionTraceManager;

@Path("/karte")
public class KarteDocumentWriteResource extends AbstractResource {

    private static final Logger LOGGER = Logger.getLogger(KarteDocumentWriteResource.class.getName());

    @Inject
    private KarteServiceBean karteServiceBean;

    @Inject
    private PVTServiceBean pvtServiceBean;

    @Inject
    private AuditTrailService auditTrailService;

    @Inject
    private SessionTraceManager sessionTraceManager;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private ObjectMapper objectMapper;

    @Context
    private HttpServletRequest httpServletRequest;

    @POST
    @Path("/document")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String postDocument(String json) throws IOException {
        DocumentModel document = readJson(json, DocumentModel.class);
        ensureDocumentPayloadFacility(document, null);
        populateDocumentRelations(document);

        long result = karteServiceBean.addDocument(document);
        String pkStr = String.valueOf(result);
        debug(pkStr);

        return pkStr;
    }

    @PUT
    @Path("/document")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String putDocument(String json) throws IOException {
        DocumentModel document = readJson(json, DocumentModel.class);
        ensureDocumentPayloadFacility(document, null);
        populateDocumentRelations(document);

        long result = karteServiceBean.updateDocument(document);
        return String.valueOf(result);
    }

    @POST
    @Path("/document/pvt/{params}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String postDocument(@PathParam("params") String param, String json) throws IOException {

        String[] params = param.split(CAMMA);
        long pvtPK = Long.parseLong(params[0]);
        int state = Integer.parseInt(params[1]);

        DocumentModel document = readJson(json, DocumentModel.class);
        ensureDocumentPayloadFacility(document, null);
        populateDocumentRelations(document);

        long result = karteServiceBean.addDocument(document);
        String pkStr = String.valueOf(result);

        if (params.length == 2) {
            try {
                pvtServiceBean.updatePvtState(pvtPK, state);
                Logger.getLogger("open.dolphin").info("PVT state did update: " + pvtPK + " = " + state);
            } catch (Throwable t) {
                Logger.getLogger("open.dolphin").warning(t.getMessage());
            }
        }

        return pkStr;
    }

    @PUT
    @Path("/document/{id}")
    @Consumes(MediaType.TEXT_PLAIN)
    @Produces(MediaType.TEXT_PLAIN)
    public String putTitle(@PathParam("id") String idStr, String title) {

        long id = Long.parseLong(idStr);
        ensureDocumentFacilityAccess(id, null);

        int result = karteServiceBean.updateTitle(id, title);

        return String.valueOf(result);
    }

    @DELETE
    @Path("/document/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public StringListConverter deleteDocument(@PathParam("id") String idStr) {

        long id = Long.parseLong(idStr);
        ensureDocumentFacilityAccess(id, null);
        DocumentModel document = null;
        try {
            List<DocumentModel> documents = karteServiceBean.getDocuments(List.of(id));
            if (documents != null && !documents.isEmpty()) {
                document = documents.get(0);
            }
        } catch (Exception ex) {
            LOGGER.log(Level.FINE, "Failed to resolve document metadata for audit [id=" + id + "]", ex);
        }

        try {
            List<String> list = karteServiceBean.deleteDocument(id);
            recordDocumentDeletionAudit(id, document, list, "success", null, null);
            StringList strList = new StringList();
            strList.setList(list);
            StringListConverter conv = new StringListConverter();
            conv.setModel(strList);
            return conv;
        } catch (RuntimeException ex) {
            String message = ex.getMessage();
            if (message == null || message.isBlank()) {
                message = "Document delete failed.";
            }
            recordDocumentDeletionAudit(id, document, null, "failed", ex.getClass().getSimpleName(), message);
            throw ex;
        }
    }

    protected <T> T readJson(String json, Class<T> type) throws IOException {
        return LegacyJsonSupport.readBody(json, type, objectMapper);
    }

    private HttpServletRequest resolveRequest(HttpServletRequest explicit) {
        return explicit != null ? explicit : httpServletRequest;
    }

    private String resolveFacilityId(HttpServletRequest request) {
        String remoteUser = request != null ? request.getRemoteUser() : null;
        String facility = getRemoteFacility(remoteUser);
        if (facility == null || facility.isBlank()) {
            Map<String, Object> extras = new HashMap<>();
            extras.put("remoteUser", remoteUser);
            throw AbstractResource.restError(request, Response.Status.UNAUTHORIZED, "facility_missing",
                    "Facility identifier is not available", extras, null);
        }
        return facility.trim();
    }

    private void ensureKarteFacilityAccess(long karteId, HttpServletRequest request) {
        if (karteId <= 0) {
            return;
        }
        HttpServletRequest effectiveRequest = resolveRequest(request);
        String actorFacility = resolveFacilityId(effectiveRequest);
        String targetFacility = karteServiceBean.findFacilityIdByKarteId(karteId);
        ensureFacilityMatch(actorFacility, targetFacility, "karteId", karteId, effectiveRequest);
    }

    private void ensureDocumentFacilityAccess(long docId, HttpServletRequest request) {
        if (docId <= 0) {
            return;
        }
        HttpServletRequest effectiveRequest = resolveRequest(request);
        String actorFacility = resolveFacilityId(effectiveRequest);
        String targetFacility = karteServiceBean.findFacilityIdByDocId(docId);
        ensureFacilityMatch(actorFacility, targetFacility, "docId", docId, effectiveRequest);
    }

    private void ensureDocumentPayloadFacility(DocumentModel document, HttpServletRequest request) {
        if (document == null) {
            return;
        }
        if (document.getId() > 0) {
            ensureDocumentFacilityAccess(document.getId(), request);
        }
        if (document.getKarteBean() != null && document.getKarteBean().getId() > 0) {
            ensureKarteFacilityAccess(document.getKarteBean().getId(), request);
        }
    }

    private void ensureFacilityMatch(String actorFacility,
                                     String targetFacility,
                                     String idName,
                                     long idValue,
                                     HttpServletRequest request) {
        if (actorFacility == null || actorFacility.isBlank()
                || targetFacility == null || targetFacility.isBlank()
                || !actorFacility.equals(targetFacility.trim())) {
            Map<String, Object> details = new HashMap<>();
            details.put("actorFacilityId", actorFacility);
            details.put("targetFacilityId", targetFacility);
            details.put(idName, idValue);
            throw AbstractResource.restError(request, Response.Status.FORBIDDEN, "forbidden", "Access denied",
                    details, null);
        }
    }

    private void populateDocumentRelations(DocumentModel document) {
        if (document == null) {
            return;
        }
        List<ModuleModel> modules = document.getModules();
        if (modules != null) {
            for (ModuleModel module : modules) {
                module.setDocumentModel(document);
            }
        }
        List<SchemaModel> schemas = document.getSchema();
        if (schemas != null) {
            for (SchemaModel schemaModel : schemas) {
                schemaModel.setDocumentModel(document);
            }
        }
        List<AttachmentModel> attachments = document.getAttachment();
        if (attachments != null) {
            for (AttachmentModel attachmentModel : attachments) {
                attachmentModel.setDocumentModel(document);
            }
        }
    }

    private void recordDocumentDeletionAudit(long documentPk,
                                             DocumentModel document,
                                             List<String> deletedDocIds,
                                             String status,
                                             String reason,
                                             String errorMessage) {
        if (auditTrailService == null) {
            return;
        }
        try {
            AuditEventPayload payload = createBaseAuditPayload("KARTE_DOCUMENT_DELETE");
            Map<String, Object> details = new HashMap<>();
            details.put("status", status);
            details.put("documentPk", documentPk);
            if (deletedDocIds != null) {
                details.put("deletedDocIds", List.copyOf(deletedDocIds));
                details.put("deletedCount", deletedDocIds.size());
            }
            if (reason != null && !reason.isBlank()) {
                details.put("reason", reason);
            }
            if (errorMessage != null && !errorMessage.isBlank()) {
                details.put("errorMessage", errorMessage);
            }
            if (document != null) {
                if (document.getDocInfoModel() != null) {
                    details.put("documentId", document.getDocInfoModel().getDocId());
                }
                if (document.getKarteBean() != null) {
                    details.put("karteId", document.getKarteBean().getId());
                }
                if (document.getKarteBean() != null && document.getKarteBean().getPatientModel() != null) {
                    details.put("patientId", document.getKarteBean().getPatientModel().getPatientId());
                }
            }
            enrichUserDetails(details);
            enrichTraceDetails(details);
            payload.setPatientId(AuditDetailSanitizer.resolvePatientId(null, details));
            payload.setDetails(details);
            auditTrailService.record(payload);
        } catch (Exception ex) {
            LOGGER.log(Level.FINE, "Failed to record document deletion audit [documentPk=" + documentPk + "]", ex);
        }
    }

    private AuditEventPayload createBaseAuditPayload(String action) {
        AuditEventPayload payload = new AuditEventPayload();
        String actorId = resolveActorId();
        payload.setActorId(actorId);
        payload.setActorDisplayName(resolveActorDisplayName(actorId));
        payload.setActorRole(resolveActorRole(httpServletRequest, userServiceBean));
        payload.setAction(action);
        payload.setResource(resolveResourcePath());
        String requestId = resolveRequestId();
        String traceId = resolveTraceId(httpServletRequest);
        if (traceId == null || traceId.isBlank()) {
            traceId = requestId;
        }
        payload.setRequestId(requestId);
        payload.setTraceId(traceId);
        payload.setIpAddress(resolveClientIp(httpServletRequest));
        payload.setUserAgent(resolveUserAgent());
        return payload;
    }

    private void enrichUserDetails(Map<String, Object> details) {
        String remoteUser = resolveRemoteUser();
        if (remoteUser != null) {
            details.put("remoteUser", remoteUser);
            int idx = remoteUser.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
            if (idx > 0) {
                details.put("facilityId", remoteUser.substring(0, idx));
                if (idx + 1 < remoteUser.length()) {
                    details.put("userId", remoteUser.substring(idx + 1));
                }
            }
        }
    }

    private void enrichTraceDetails(Map<String, Object> details) {
        boolean traceCaptured = false;
        if (sessionTraceManager != null) {
            SessionTraceContext context = sessionTraceManager.current();
            if (context != null) {
                details.put("traceId", context.getTraceId());
                details.put("sessionOperation", context.getOperation());
                traceCaptured = true;
            }
        }
        if (!traceCaptured) {
            String traceId = resolveTraceId(httpServletRequest);
            if (traceId != null) {
                details.put("traceId", traceId);
            }
        }
    }

    private String resolveActorId() {
        return Optional.ofNullable(resolveRemoteUser()).orElse("system");
    }

    private String resolveActorDisplayName(String actorId) {
        if (actorId == null) {
            return "system";
        }
        int idx = actorId.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (idx >= 0 && idx + 1 < actorId.length()) {
            return actorId.substring(idx + 1);
        }
        return actorId;
    }

    private String resolveResourcePath() {
        return httpServletRequest != null ? httpServletRequest.getRequestURI() : "/karte";
    }

    private String resolveRequestId() {
        if (httpServletRequest == null) {
            return UUID.randomUUID().toString();
        }
        return Optional.ofNullable(httpServletRequest.getHeader("X-Request-Id"))
                .orElse(UUID.randomUUID().toString());
    }

    private String resolveUserAgent() {
        return httpServletRequest != null ? httpServletRequest.getHeader("User-Agent") : null;
    }

    private String resolveRemoteUser() {
        return httpServletRequest != null ? httpServletRequest.getRemoteUser() : null;
    }
}

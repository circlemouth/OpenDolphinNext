package open.dolphin.rest;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
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
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.support.LegacyJsonSupport;
import open.dolphin.security.audit.AuditDetailSanitizer;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientImageServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.session.framework.SessionTraceContext;
import open.dolphin.session.framework.SessionTraceManager;
import open.dolphin.storage.attachment.AttachmentStorageManager;

@Path("/karte")
public class KarteDocumentWriteResource extends AbstractResource {

    private static final Logger LOGGER = Logger.getLogger(KarteDocumentWriteResource.class.getName());
    private static final String ERROR_CODE_ATTACHMENT_REFERENCE_UNSUPPORTED = "attachment_reference_unsupported";
    private static final String ERROR_CODE_ATTACHMENT_REFERENCE_NOT_FOUND = "attachment_reference_not_found";
    private static final String ERROR_CODE_ATTACHMENT_REFERENCE_SCOPE_MISMATCH = "attachment_reference_scope_mismatch";
    private static final String ERROR_CODE_ATTACHMENT_REFERENCE_CONTRACT = "attachment_reference_contract_violation";
    private static final String QUERY_ATTACHMENT_REFERENCE_SOURCE =
            "select a from AttachmentModel a "
                    + "join fetch a.karte k "
                    + "join fetch k.patient p "
                    + "left join fetch a.creator "
                    + "where a.id=:id";

    @Inject
    private KarteServiceBean karteServiceBean;

    @Inject
    private AuditTrailService auditTrailService;

    @Inject
    private SessionTraceManager sessionTraceManager;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private ObjectMapper objectMapper;

    @PersistenceContext
    private EntityManager em;

    @Context
    private HttpServletRequest httpServletRequest;

    @POST
    @Path("/document")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String postDocument(String json) throws IOException {
        DocumentModel document = readJson(json, DocumentModel.class);
        normalizeAttachmentReferencePayload(document, null);
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
        normalizeAttachmentReferencePayload(document, null);
        ensureDocumentPayloadFacility(document, null);
        populateDocumentRelations(document);

        long result = karteServiceBean.updateDocument(document);
        return String.valueOf(result);
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

    private String requireActorFacilityId(HttpServletRequest request) {
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
        String actorFacility = requireActorFacilityId(effectiveRequest);
        String targetFacility = karteServiceBean.findFacilityIdByKarteId(karteId);
        ensureFacilityMatch(actorFacility, targetFacility, "karteId", karteId, effectiveRequest);
    }

    private void ensureDocumentFacilityAccess(long docId, HttpServletRequest request) {
        if (docId <= 0) {
            return;
        }
        HttpServletRequest effectiveRequest = resolveRequest(request);
        String actorFacility = requireActorFacilityId(effectiveRequest);
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

    private void normalizeAttachmentReferencePayload(DocumentModel document, HttpServletRequest request) {
        if (document == null) {
            return;
        }
        List<AttachmentModel> attachments = document.getAttachment();
        if (attachments == null || attachments.isEmpty()) {
            return;
        }
        List<AttachmentModel> resolvedAttachments = new ArrayList<>(attachments.size());
        boolean usedResolvedReference = false;
        String authoritativePatientId = null;
        long authoritativeKarteId = 0L;
        HttpServletRequest effectiveRequest = resolveRequest(request);
        String actorFacility = requireActorFacilityId(effectiveRequest);
        UserModel actor = resolveActorUser(effectiveRequest);
        for (AttachmentModel attachment : attachments) {
            if (attachment == null) {
                continue;
            }
            if (attachment.getId() <= 0L) {
                throw attachmentReferenceError(
                        effectiveRequest,
                        Response.Status.BAD_REQUEST,
                        ERROR_CODE_ATTACHMENT_REFERENCE_UNSUPPORTED,
                        "Attachment reference payload must use a server-resolved attachment id.",
                        Map.of("attachmentId", attachment.getId(), "acceptedReference", "id"));
            }
            AttachmentModel source = resolveAttachmentReferenceSource(attachment.getId(), effectiveRequest, actorFacility);
            if (!PatientImageServiceBean.LINK_RELATION_PATIENT_IMAGE_PHASEA.equals(source.getLinkRelation())) {
                throw attachmentReferenceError(
                        effectiveRequest,
                        Response.Status.CONFLICT,
                        ERROR_CODE_ATTACHMENT_REFERENCE_UNSUPPORTED,
                        "Attachment reference payload only supports patient image assets.",
                        Map.of("attachmentId", attachment.getId(), "linkRelation", source.getLinkRelation()));
            }
            if (source.getKarteBean() == null || source.getKarteBean().getPatientModel() == null) {
                throw attachmentReferenceError(
                        effectiveRequest,
                        Response.Status.CONFLICT,
                        ERROR_CODE_ATTACHMENT_REFERENCE_CONTRACT,
                        "Attachment reference source is missing patient scope.",
                        Map.of("attachmentId", attachment.getId()));
            }
            String sourcePatientId = source.getKarteBean().getPatientModel().getPatientId();
            long sourceKarteId = source.getKarteBean().getId();
            if (sourcePatientId == null || sourcePatientId.isBlank() || sourceKarteId <= 0L) {
                throw attachmentReferenceError(
                        effectiveRequest,
                        Response.Status.CONFLICT,
                        ERROR_CODE_ATTACHMENT_REFERENCE_CONTRACT,
                        "Attachment reference source is missing authoritative identifiers.",
                        Map.of("attachmentId", attachment.getId(), "karteId", sourceKarteId, "patientId", sourcePatientId));
            }
            if (authoritativePatientId == null) {
                authoritativePatientId = sourcePatientId;
                authoritativeKarteId = sourceKarteId;
            } else if (!authoritativePatientId.equals(sourcePatientId) || authoritativeKarteId != sourceKarteId) {
                throw attachmentReferenceError(
                        effectiveRequest,
                        Response.Status.CONFLICT,
                        ERROR_CODE_ATTACHMENT_REFERENCE_SCOPE_MISMATCH,
                        "Attachment references must belong to the same patient chart.",
                        Map.of(
                                "attachmentId", attachment.getId(),
                                "sourcePatientId", sourcePatientId,
                                "authoritativePatientId", authoritativePatientId,
                                "sourceKarteId", sourceKarteId,
                                "authoritativeKarteId", authoritativeKarteId));
            }
            resolvedAttachments.add(cloneAttachmentReference(source, attachment.getId(), actor));
            usedResolvedReference = true;
        }
        if (usedResolvedReference) {
            document.setAttachment(resolvedAttachments);
            applyReferenceDocumentDefaults(document, actor, authoritativeKarteId, authoritativePatientId);
        }
    }

    private AttachmentModel resolveAttachmentReferenceSource(long attachmentId,
                                                            HttpServletRequest request,
                                                            String actorFacility) {
        ensureAttachmentFacilityAccess(attachmentId, request);
        try {
            AttachmentModel source = em.createQuery(QUERY_ATTACHMENT_REFERENCE_SOURCE, AttachmentModel.class)
                    .setParameter("id", attachmentId)
                    .getSingleResult();
            if (source == null) {
                throw attachmentReferenceError(
                        request,
                        Response.Status.NOT_FOUND,
                        ERROR_CODE_ATTACHMENT_REFERENCE_NOT_FOUND,
                        "Attachment reference source was not found.",
                        Map.of("attachmentId", attachmentId));
            }
            String sourceFacility = source.getKarteBean() != null
                    && source.getKarteBean().getPatientModel() != null
                    ? source.getKarteBean().getPatientModel().getFacilityId()
                    : null;
            if (sourceFacility == null || sourceFacility.isBlank() || !actorFacility.equals(sourceFacility.trim())) {
                throw attachmentReferenceError(
                        request,
                        Response.Status.FORBIDDEN,
                        ERROR_CODE_ATTACHMENT_REFERENCE_SCOPE_MISMATCH,
                        "Attachment reference source is outside the current facility.",
                        Map.of("attachmentId", attachmentId, "actorFacilityId", actorFacility, "sourceFacilityId", sourceFacility));
            }
            if (!hasText(source.getUri()) || !hasText(source.getDigest())) {
                throw attachmentReferenceError(
                        request,
                        Response.Status.CONFLICT,
                        ERROR_CODE_ATTACHMENT_REFERENCE_CONTRACT,
                        "Attachment reference source is missing object metadata.",
                        Map.of("attachmentId", attachmentId));
            }
            return source;
        } catch (NoResultException ex) {
            throw attachmentReferenceError(
                    request,
                    Response.Status.NOT_FOUND,
                    ERROR_CODE_ATTACHMENT_REFERENCE_NOT_FOUND,
                    "Attachment reference source was not found.",
                    Map.of("attachmentId", attachmentId));
        }
    }

    private AttachmentModel cloneAttachmentReference(AttachmentModel source, long sourceAttachmentId, UserModel actor) {
        AttachmentModel reference = new AttachmentModel();
        reference.setFileName(source.getFileName());
        reference.setContentType(source.getContentType());
        reference.setContentSize(source.getContentSize());
        reference.setLastModified(source.getLastModified());
        reference.setDigest(source.getDigest());
        reference.setTitle(source.getTitle());
        reference.setUri(source.getUri());
        reference.setStorageProvider(source.getStorageProvider());
        reference.setStorageBucket(source.getStorageBucket());
        reference.setStorageKey(source.getStorageKey());
        reference.setStorageVersionId(source.getStorageVersionId());
        reference.setStorageEtag(source.getStorageEtag());
        reference.setExtension(source.getExtension());
        reference.setMemo(source.getMemo());
        reference.setLinkId(sourceAttachmentId);
        reference.setLinkRelation(AttachmentStorageManager.LINK_RELATION_REFERENCE_ONLY);
        reference.setStatus(source.getStatus());
        reference.setStarted(source.getStarted());
        reference.setConfirmed(source.getConfirmed());
        reference.setRecorded(source.getRecorded());
        reference.setEnded(null);
        reference.setKarteBean(source.getKarteBean());
        reference.setUserModel(actor != null ? actor : source.getUserModel());
        reference.setContentBytes(null);
        return reference;
    }

    private void applyReferenceDocumentDefaults(DocumentModel document,
                                               UserModel actor,
                                               long authoritativeKarteId,
                                               String authoritativePatientId) {
        if (document.getKarteBean() == null || document.getKarteBean().getId() <= 0L) {
            document.setKarteBean(new open.dolphin.infomodel.KarteBean());
        }
        document.getKarteBean().setId(authoritativeKarteId);
        if (document.getDocInfoModel() == null) {
            document.setDocInfoModel(new open.dolphin.infomodel.DocInfoModel());
        }
        if (!hasText(document.getDocInfoModel().getDocId())) {
            document.getDocInfoModel().setDocId(UUID.randomUUID().toString().replace("-", ""));
        }
        if (!hasText(document.getDocInfoModel().getTitle())) {
            document.getDocInfoModel().setTitle("文書画像参照");
        }
        if (!hasText(document.getDocInfoModel().getPurpose())) {
            document.getDocInfoModel().setPurpose(IInfoModel.PURPOSE_RECORD);
        }
        if (!hasText(document.getStatus())) {
            document.setStatus(IInfoModel.STATUS_TMP);
        }
        if (document.getStarted() == null || document.getConfirmed() == null || document.getRecorded() == null) {
            java.util.Date now = new java.util.Date();
            if (document.getStarted() == null) {
                document.setStarted(now);
            }
            if (document.getConfirmed() == null) {
                document.setConfirmed(now);
            }
            if (document.getRecorded() == null) {
                document.setRecorded(now);
            }
        }
        if (actor != null) {
            document.setUserModel(actor);
        }
        document.getDocInfoModel().setStatus(document.getStatus());
        if (authoritativePatientId != null && !authoritativePatientId.isBlank()) {
            document.getDocInfoModel().setPatientId(authoritativePatientId);
        }
    }

    private void ensureAttachmentFacilityAccess(long attachmentId, HttpServletRequest request) {
        if (attachmentId <= 0L) {
            return;
        }
        HttpServletRequest effectiveRequest = resolveRequest(request);
        String actorFacility = requireActorFacilityId(effectiveRequest);
        String targetFacility = karteServiceBean.findFacilityIdByAttachmentId(attachmentId);
        ensureFacilityMatch(actorFacility, targetFacility, "attachmentId", attachmentId, effectiveRequest);
    }

    private UserModel resolveActorUser(HttpServletRequest request) {
        String remoteUser = request != null ? request.getRemoteUser() : null;
        if (remoteUser == null || remoteUser.isBlank() || userServiceBean == null) {
            return null;
        }
        try {
            return userServiceBean.getUser(remoteUser);
        } catch (RuntimeException ex) {
            LOGGER.log(Level.FINE, "Failed to resolve actor user for attachment reference payload", ex);
            return null;
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private WebApplicationException attachmentReferenceError(HttpServletRequest request,
                                                             Response.Status status,
                                                             String errorCode,
                                                             String message,
                                                             Map<String, Object> details) {
        return AbstractResource.restError(request, status, errorCode, message, details, null);
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

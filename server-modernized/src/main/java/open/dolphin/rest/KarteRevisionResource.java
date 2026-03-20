package open.dolphin.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.rest.dto.KarteRevisionDocumentResponse;
import open.dolphin.rest.dto.KarteRevisionDiffResponse;
import open.dolphin.rest.dto.KarteRevisionHistoryResponse;
import open.dolphin.rest.dto.KarteRevisionWriteRequest;
import open.dolphin.rest.dto.KarteRevisionWriteResponse;
import open.dolphin.rest.support.KarteRevisionResponseMapper;
import open.dolphin.rest.support.LegacyJsonSupport;
import open.dolphin.security.audit.AuditDetailSanitizer;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.KarteRevisionServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.session.framework.SessionTraceContext;
import open.dolphin.session.framework.SessionTraceManager;

/**
 * Phase1: read-only append-only revision browsing API for chart documents.
 */
@Path("/karte/revisions")
public class KarteRevisionResource extends AbstractResource {

    private static final Logger LOGGER = Logger.getLogger(KarteRevisionResource.class.getName());

    @Inject
    private KarteRevisionServiceBean karteRevisionServiceBean;

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

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public KarteRevisionHistoryResponse getHistory(@QueryParam("karteId") Long karteId,
                                                   @QueryParam("visitDate") String visitDate,
                                                   @QueryParam("encounterId") String encounterId) {
        // Phase1: prefer visitDate; allow encounterId as alias for compatibility with earlier drafts.
        String effectiveVisitDate = (visitDate != null && !visitDate.isBlank()) ? visitDate : encounterId;

        if (karteId == null || karteId <= 0) {
            throw validationError("REVISION_VALIDATION_ERROR", "karteId is required", Map.of("karteId", karteId));
        }
        ensureKarteFacilityAccess(karteId);
        LocalDate day = parseLocalDateOrThrow(effectiveVisitDate, "visitDate");

        KarteRevisionHistoryResponse response = karteRevisionServiceBean.getRevisionHistory(karteId, day);
        recordAudit("KARTE_REVISION_HISTORY_READ", Map.of(
                "status", "SUCCESS",
                "karteId", karteId,
                "visitDate", day.toString()
        ));
        return response;
    }

    @GET
    @Path("/{revisionId}")
    @Produces(MediaType.APPLICATION_JSON)
    public KarteRevisionDocumentResponse getRevision(@PathParam("revisionId") long revisionId) {
        if (revisionId <= 0) {
            throw validationError("REVISION_VALIDATION_ERROR", "revisionId is required",
                    Map.of("revisionId", revisionId));
        }
        ensureRevisionFacilityAccess(revisionId);

        DocumentModel doc = karteRevisionServiceBean.getRevisionSnapshotLight(revisionId);
        if (doc == null) {
            recordAudit("KARTE_REVISION_GET", Map.of(
                    "status", "MISSING",
                    "revisionId", revisionId,
                    "createdRevisionId", revisionId
            ));
            throw restError(httpServletRequest, jakarta.ws.rs.core.Response.Status.NOT_FOUND,
                    "revision_not_found", "Revision not found",
                    Map.of("revisionId", revisionId),
                    null);
        }
        recordAudit("KARTE_REVISION_GET", withPatientId(Map.of(
                "status", "SUCCESS",
                "revisionId", revisionId,
                "createdRevisionId", revisionId
        ), doc));
        return KarteRevisionResponseMapper.map(doc);
    }

    @GET
    @Path("/diff")
    @Produces(MediaType.APPLICATION_JSON)
    public KarteRevisionDiffResponse diff(@QueryParam("fromRevisionId") Long fromRevisionId,
                                          @QueryParam("toRevisionId") Long toRevisionId) {
        if (fromRevisionId == null || fromRevisionId <= 0 || toRevisionId == null || toRevisionId <= 0) {
            throw validationError("REVISION_VALIDATION_ERROR",
                    "fromRevisionId/toRevisionId are required",
                    Map.of("fromRevisionId", fromRevisionId, "toRevisionId", toRevisionId));
        }
        ensureRevisionFacilityAccess(fromRevisionId);
        ensureRevisionFacilityAccess(toRevisionId);

        KarteRevisionDiffResponse response = karteRevisionServiceBean.diffRevisions(fromRevisionId, toRevisionId);
        if (response == null) {
            recordAudit("KARTE_REVISION_DIFF", Map.of(
                    "status", "MISSING",
                    "fromRevisionId", fromRevisionId,
                    "toRevisionId", toRevisionId,
                    "baseRevisionId", fromRevisionId,
                    "createdRevisionId", toRevisionId
            ));
            throw restError(httpServletRequest, jakarta.ws.rs.core.Response.Status.NOT_FOUND,
                    "revision_not_found", "Revision not found",
                    Map.of("fromRevisionId", fromRevisionId, "toRevisionId", toRevisionId),
                    null);
        }

        recordAudit("KARTE_REVISION_DIFF", Map.of(
                "status", "SUCCESS",
                "fromRevisionId", fromRevisionId,
                "toRevisionId", toRevisionId,
                "baseRevisionId", fromRevisionId,
                "createdRevisionId", toRevisionId
        ));
        return response;
    }

    @POST
    @Path("/revise")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public KarteRevisionWriteResponse revise(String json, @HeaderParam("If-Match") String ifMatch) throws Exception {
        return writeRevision("revise", json, ifMatch);
    }

    @POST
    @Path("/restore")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public KarteRevisionWriteResponse restore(String json, @HeaderParam("If-Match") String ifMatch) throws Exception {
        return writeRevision("restore", json, ifMatch);
    }

    private KarteRevisionWriteResponse writeRevision(String operation, String json, String ifMatch) throws Exception {
        if (operation == null || operation.isBlank()) {
            throw validationError("REVISION_VALIDATION_ERROR", "operation is required", Map.of("operation", operation));
        }
        KarteRevisionWriteRequest request = LegacyJsonSupport.readBody(json, KarteRevisionWriteRequest.class, objectMapper);

        long sourceRevisionId = request != null && request.getSourceRevisionId() != null ? request.getSourceRevisionId() : 0L;
        long baseRevisionId = request != null && request.getBaseRevisionId() != null ? request.getBaseRevisionId() : 0L;
        if (baseRevisionId <= 0) {
            baseRevisionId = parseIfMatchRevisionId(ifMatch);
        }

        if (sourceRevisionId <= 0) {
            throw validationError("REVISION_VALIDATION_ERROR", "sourceRevisionId is required",
                    Map.of("sourceRevisionId", request != null ? request.getSourceRevisionId() : null));
        }
        if (baseRevisionId <= 0) {
            throw validationError("REVISION_VALIDATION_ERROR", "baseRevisionId (or If-Match) is required",
                    Map.of("baseRevisionId", request != null ? request.getBaseRevisionId() : null,
                            "ifMatch", ifMatch));
        }
        ensureRevisionFacilityAccess(sourceRevisionId);
        ensureRevisionFacilityAccess(baseRevisionId);

        DocumentModel source = karteRevisionServiceBean.getRevisionSnapshot(sourceRevisionId);
        if (source == null) {
            recordAudit("KARTE_REVISION_" + operation.toUpperCase(), Map.of(
                    "status", "MISSING_SOURCE",
                    "operation", operation,
                    "operationPhase", operation.equals("restore") ? "restore" : "edit",
                    "sourceRevisionId", sourceRevisionId,
                    "baseRevisionId", baseRevisionId
            ));
            throw restError(httpServletRequest, jakarta.ws.rs.core.Response.Status.NOT_FOUND,
                    "revision_not_found", "Revision not found",
                    Map.of("sourceRevisionId", sourceRevisionId),
                    null);
        }

        // Conflict check: require baseRevisionId to match latestRevisionId in the relevant group.
        LocalDate visitDate = deriveVisitDate(source);
        Long karteId = source.getKarteBean() != null ? source.getKarteBean().getId() : null;
        if (karteId == null || karteId <= 0) {
            throw validationError("REVISION_VALIDATION_ERROR", "karteId missing on source revision",
                    Map.of("sourceRevisionId", sourceRevisionId));
        }

        KarteRevisionHistoryResponse history = karteRevisionServiceBean.getRevisionHistory(karteId, visitDate);
        GroupMatch match = findGroup(history, sourceRevisionId, baseRevisionId);
        if (match == null || match.latestRevisionId == null || match.latestRevisionId <= 0) {
            throw restError(httpServletRequest, jakarta.ws.rs.core.Response.Status.NOT_FOUND,
                    "revision_group_not_found", "Revision group not found",
                    Map.of("karteId", karteId, "visitDate", visitDate.toString(),
                            "sourceRevisionId", sourceRevisionId, "baseRevisionId", baseRevisionId),
                    null);
        }
        if (match.latestRevisionId != baseRevisionId) {
            recordAudit("KARTE_REVISION_" + operation.toUpperCase(), withPatientId(Map.of(
                    "status", "CONFLICT",
                    "operation", operation,
                    "operationPhase", operation.equals("restore") ? "restore" : "edit",
                    "sourceRevisionId", sourceRevisionId,
                    "baseRevisionId", baseRevisionId,
                    "parentRevisionId", baseRevisionId,
                    "latestRevisionId", match.latestRevisionId,
                    "rootRevisionId", match.rootRevisionId
            ), source));
            throw restError(httpServletRequest, jakarta.ws.rs.core.Response.Status.CONFLICT,
                    "REVISION_CONFLICT", "baseRevisionId does not match latestRevisionId",
                    Map.of(
                            "operation", operation,
                            "sourceRevisionId", sourceRevisionId,
                            "baseRevisionId", baseRevisionId,
                            "latestRevisionId", match.latestRevisionId,
                            "rootRevisionId", match.rootRevisionId,
                            "visitDate", visitDate.toString(),
                            "karteId", karteId
                    ),
                    null);
        }

        // Append-only: create a new revision as a new Document row. Parent is the current latest revision.
        long createdRevisionId = karteRevisionServiceBean.createRevisionFromSource(sourceRevisionId, baseRevisionId, operation);

        KarteRevisionWriteResponse response = new KarteRevisionWriteResponse();
        response.setOperation(operation);
        response.setOperationPhase(operation.equals("restore") ? "restore" : "edit");
        response.setKarteId(karteId);
        response.setVisitDate(visitDate.toString());
        response.setRootRevisionId(match.rootRevisionId);
        response.setSourceRevisionId(sourceRevisionId);
        response.setBaseRevisionId(baseRevisionId);
        response.setParentRevisionId(baseRevisionId);
        response.setCreatedRevisionId(createdRevisionId);
        response.setCreatedAt(Instant.now().toString());

        recordAudit("KARTE_REVISION_" + operation.toUpperCase(), withPatientId(Map.of(
                "status", "SUCCESS",
                "operation", operation,
                "operationPhase", response.getOperationPhase(),
                "karteId", karteId,
                "visitDate", visitDate.toString(),
                "rootRevisionId", match.rootRevisionId,
                "sourceRevisionId", sourceRevisionId,
                "baseRevisionId", baseRevisionId,
                "parentRevisionId", baseRevisionId,
                "createdRevisionId", createdRevisionId
        ), source));
        return response;
    }

    private void ensureKarteFacilityAccess(long karteId) {
        String actorFacilityId = resolveActorFacilityId();
        String targetFacilityId = karteRevisionServiceBean.findFacilityIdByKarteId(karteId);
        ensureFacilityMatch(actorFacilityId, targetFacilityId, "karteId", karteId);
    }

    private void ensureRevisionFacilityAccess(long revisionId) {
        String actorFacilityId = resolveActorFacilityId();
        String targetFacilityId = karteRevisionServiceBean.findFacilityIdByRevisionId(revisionId);
        ensureFacilityMatch(actorFacilityId, targetFacilityId, "revisionId", revisionId);
    }

    private String resolveActorFacilityId() {
        String remoteUser = resolveRemoteUser();
        String facilityId = getRemoteFacility(remoteUser);
        if (facilityId == null || facilityId.isBlank()) {
            throw restError(httpServletRequest, jakarta.ws.rs.core.Response.Status.UNAUTHORIZED,
                    "unauthorized", "Remote user facility is required",
                    Map.of("remoteUser", remoteUser), null);
        }
        return facilityId.trim();
    }

    private String resolveRemoteUser() {
        return httpServletRequest != null ? httpServletRequest.getRemoteUser() : null;
    }

    private void ensureFacilityMatch(String actorFacilityId, String targetFacilityId, String idType, long idValue) {
        if (targetFacilityId == null || targetFacilityId.isBlank()) {
            return;
        }
        String normalizedTarget = targetFacilityId.trim();
        if (!actorFacilityId.equals(normalizedTarget)) {
            throw restError(httpServletRequest, jakarta.ws.rs.core.Response.Status.FORBIDDEN,
                    "forbidden", "Access denied",
                    Map.of("actorFacilityId", actorFacilityId,
                            "targetFacilityId", normalizedTarget,
                            idType, idValue),
                    null);
        }
    }

    private LocalDate parseLocalDateOrThrow(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw validationError("REVISION_VALIDATION_ERROR", fieldName + " is required", Map.of(fieldName, value));
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException ex) {
            throw validationError("REVISION_VALIDATION_ERROR", fieldName + " must be YYYY-MM-DD",
                    Map.of(fieldName, value));
        }
    }

    private WebApplicationException validationError(String code, String message, Map<String, ?> details) {
        // JAX-RS Response.Status does not include 422; use 400 with a structured error code/details.
        return restError(httpServletRequest, jakarta.ws.rs.core.Response.Status.BAD_REQUEST, code, message, details,
                null);
    }

    private LocalDate deriveVisitDate(DocumentModel source) {
        if (source == null || source.getStarted() == null) {
            return LocalDate.now(ZoneOffset.UTC);
        }
        return source.getStarted().toInstant().atZone(ZoneOffset.UTC).toLocalDate();
    }

    private long parseIfMatchRevisionId(String ifMatch) {
        if (ifMatch == null || ifMatch.isBlank()) {
            return 0L;
        }
        String trimmed = ifMatch.trim();
        // Common formats: 9193, "9193", W/"9193"
        if (trimmed.startsWith("W/")) {
            trimmed = trimmed.substring(2).trim();
        }
        if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length() >= 2) {
            trimmed = trimmed.substring(1, trimmed.length() - 1);
        }
        if (!trimmed.matches("\\d+")) {
            return 0L;
        }
        try {
            return Long.parseLong(trimmed);
        } catch (NumberFormatException ex) {
            return 0L;
        }
    }

    private GroupMatch findGroup(KarteRevisionHistoryResponse history, long sourceRevisionId, long baseRevisionId) {
        if (history == null || history.getGroups() == null) {
            return null;
        }
        for (var group : history.getGroups()) {
            if (group == null || group.getItems() == null) {
                continue;
            }
            boolean hit = false;
            for (var item : group.getItems()) {
                if (item == null || item.getRevisionId() == null) {
                    continue;
                }
                long id = item.getRevisionId();
                if (id == sourceRevisionId || id == baseRevisionId) {
                    hit = true;
                    break;
                }
            }
            if (!hit) {
                continue;
            }
            GroupMatch match = new GroupMatch();
            match.rootRevisionId = group.getRootRevisionId();
            match.latestRevisionId = group.getLatestRevisionId();
            return match;
        }
        return null;
    }

    private static class GroupMatch {
        Long rootRevisionId;
        Long latestRevisionId;
    }

    private String resolvePatientId(DocumentModel document) {
        if (document == null || document.getKarteBean() == null || document.getKarteBean().getPatientModel() == null) {
            return null;
        }
        return document.getKarteBean().getPatientModel().getPatientId();
    }

    private Map<String, Object> withPatientId(Map<String, Object> details, DocumentModel document) {
        Map<String, Object> enriched = new HashMap<>(details);
        String patientId = resolvePatientId(document);
        if (patientId != null && !patientId.isBlank()) {
            enriched.put("patientId", patientId);
        }
        return enriched;
    }

    private void recordAudit(String action, Map<String, Object> details) {
        if (auditTrailService == null) {
            return;
        }
        try {
            AuditEventPayload payload = new AuditEventPayload();
            String actorId = resolveActorId();
            payload.setActorId(actorId);
            payload.setActorDisplayName(resolveActorDisplayName(actorId));
            payload.setActorRole(resolveActorRole(httpServletRequest, userServiceBean));
            payload.setAction(action);
            payload.setResource(httpServletRequest != null ? httpServletRequest.getRequestURI() : "/karte/revisions");
            String requestId = resolveRequestId();
            String traceId = resolveTraceId(httpServletRequest);
            if (traceId == null || traceId.isBlank()) {
                traceId = requestId;
            }
            payload.setRequestId(requestId);
            payload.setTraceId(traceId);
            payload.setIpAddress(resolveClientIp(httpServletRequest));
            payload.setUserAgent(httpServletRequest != null ? httpServletRequest.getHeader("User-Agent") : null);

            Map<String, Object> enriched = new HashMap<>();
            if (details != null) {
                enriched.putAll(details);
            }
            enrichUserDetails(enriched);
            enrichTraceDetails(enriched);
            // Ensure Phase1 audit container can carry cmd21 alignment fields (append-only tracking).
            enriched.putIfAbsent("operation", null);
            enriched.putIfAbsent("operationPhase", null);
            enriched.putIfAbsent("sourceRevisionId", null);
            enriched.putIfAbsent("baseRevisionId", null);
            enriched.putIfAbsent("createdRevisionId", null);
            enriched.putIfAbsent("parentRevisionId", null);
            enriched.putIfAbsent("rootRevisionId", null);
            payload.setPatientId(AuditDetailSanitizer.resolvePatientId(null, enriched));
            payload.setDetails(enriched);

            auditTrailService.record(payload);
        } catch (Exception ex) {
            LOGGER.log(Level.FINE, "Failed to record revision audit action=" + action, ex);
        }
    }

    private void enrichUserDetails(Map<String, Object> details) {
        String remoteUser = httpServletRequest != null ? httpServletRequest.getRemoteUser() : null;
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
        return Optional.ofNullable(httpServletRequest != null ? httpServletRequest.getRemoteUser() : null)
                .orElse("system");
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

    private String resolveRequestId() {
        if (httpServletRequest == null) {
            return UUID.randomUUID().toString();
        }
        String header = httpServletRequest.getHeader("X-Request-Id");
        if (header != null && !header.isBlank()) {
            return header.trim();
        }
        return UUID.randomUUID().toString();
    }
}

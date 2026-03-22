package open.dolphin.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.converter.PublishedTreeListConverter;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.IStampTreeModel;
import open.dolphin.infomodel.PublishedTreeList;
import open.dolphin.infomodel.PublishedTreeModel;
import open.dolphin.infomodel.StampModel;
import open.dolphin.infomodel.StampTreeHolder;
import open.dolphin.infomodel.StampTreeModel;
import open.dolphin.infomodel.SubscribedTreeModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.StampServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.session.framework.SessionTraceContext;
import open.dolphin.session.framework.SessionTraceManager;

final class StampResourceSupport {

    private static final Logger LOGGER = Logger.getLogger(StampResourceSupport.class.getName());

    private final AbstractResource resource;
    private final HttpServletRequest request;
    private final UserServiceBean userServiceBean;
    private final AuditTrailService auditTrailService;
    private final SessionTraceManager sessionTraceManager;
    private final StampServiceBean stampServiceBean;

    StampResourceSupport(AbstractResource resource,
                         HttpServletRequest request,
                         UserServiceBean userServiceBean,
                         AuditTrailService auditTrailService,
                         SessionTraceManager sessionTraceManager,
                         StampServiceBean stampServiceBean) {
        this.resource = resource;
        this.request = request;
        this.userServiceBean = userServiceBean;
        this.auditTrailService = auditTrailService;
        this.sessionTraceManager = sessionTraceManager;
        this.stampServiceBean = stampServiceBean;
    }

    UserModel resolveActorUser() {
        String remoteUser = resolveRemoteUser();
        if (remoteUser == null || remoteUser.isBlank()) {
            throw resource.restError(request, Response.Status.UNAUTHORIZED, "unauthorized",
                    "Remote user is not authenticated", null, null);
        }
        try {
            UserModel actor = userServiceBean.getUser(remoteUser);
            if (actor == null || actor.getId() <= 0) {
                throw resource.restError(request, Response.Status.UNAUTHORIZED, "unauthorized",
                        "Authenticated actor is invalid", Map.of("remoteUser", remoteUser), null);
            }
            return actor;
        } catch (WebApplicationException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw resource.restError(request, Response.Status.UNAUTHORIZED, "unauthorized",
                    "Authenticated actor is invalid", Map.of("remoteUser", remoteUser), ex);
        }
    }

    long resolveActorUserPk() {
        return resolveActorUser().getId();
    }

    void ensureActorOwnsUserPk(long requestedUserPk, long actorUserPk, String fieldName) {
        if (requestedUserPk != actorUserPk) {
            throw resource.restError(request, Response.Status.FORBIDDEN, "forbidden", "Access denied",
                    Map.of("requestedUserPk", requestedUserPk, "actorUserPk", actorUserPk, "field", fieldName), null);
        }
    }

    void applyActorToTree(StampTreeModel model, UserModel actorUser) {
        if (model != null && actorUser != null) {
            model.setUserModel(actorUser);
        }
    }

    void applyActorToTreeHolder(StampTreeHolder holder, UserModel actorUser) {
        if (holder == null || actorUser == null) {
            return;
        }
        StampTreeModel personal = holder.getPersonalTree();
        if (personal != null) {
            applyActorToTree(personal, actorUser);
        }
        if (holder.getSubscribedList() != null) {
            for (IStampTreeModel tree : holder.getSubscribedList()) {
                if (tree instanceof PublishedTreeModel published) {
                    published.setUserModel(actorUser);
                }
            }
        }
    }

    void applyActorToSubscribedTrees(List<SubscribedTreeModel> models, UserModel actorUser) {
        if (models != null && actorUser != null) {
            for (SubscribedTreeModel model : models) {
                if (model != null) {
                    model.setUserModel(actorUser);
                }
            }
        }
    }

    void ensureUnsubscribeOwnership(List<Long> idPairs, long actorUserPk) {
        if (idPairs == null || idPairs.isEmpty()) {
            return;
        }
        if (idPairs.size() % 2 != 0) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "invalid_request",
                    "idPks must be paired as treeId,userPK", Map.of("idPks", idPairs), null);
        }
        for (int i = 0; i < idPairs.size(); i += 2) {
            ensureActorOwnsUserPk(idPairs.get(i + 1), actorUserPk, "unsubscribe.userPK");
        }
    }

    void applyActorToStamp(StampModel stamp, long actorUserPk) {
        if (stamp != null) {
            stamp.setUserId(actorUserPk);
        }
    }

    void applyActorToStamps(List<StampModel> stamps, long actorUserPk) {
        if (stamps != null) {
            for (StampModel stamp : stamps) {
                applyActorToStamp(stamp, actorUserPk);
            }
        }
    }

    void ensureStampOwnership(StampModel stamp, long actorUserPk, String stampId) {
        if (stamp != null && stamp.getUserId() != actorUserPk) {
            throw resource.restError(request, Response.Status.FORBIDDEN, "forbidden", "Access denied",
                    Map.of("stampId", stampId, "requestedUserPk", stamp.getUserId(), "actorUserPk", actorUserPk), null);
        }
    }

    void ensureStampOwnership(List<StampModel> stamps, List<String> ids, long actorUserPk) {
        if (stamps == null || ids == null) {
            return;
        }
        int upper = Math.min(stamps.size(), ids.size());
        for (int i = 0; i < upper; i++) {
            StampModel stamp = stamps.get(i);
            if (stamp != null) {
                ensureStampOwnership(stamp, actorUserPk, ids.get(i));
            }
        }
    }

    String[] splitPkAndVersion(String value) {
        if (value == null) {
            return new String[]{null, null};
        }
        String[] parts = value.split(AbstractResource.CAMMA, 2);
        return parts.length == 1 ? new String[]{parts[0], null} : parts;
    }

    StampTreeModel deserializeStampTree(AbstractResource resource, String json) throws IOException {
        StampTreeModel model = resource.readJson(json, StampTreeModel.class);
        ensureTreeBytes(model);
        return model;
    }

    void recordStampDeletionAudit(String action, List<String> ids, String status, Integer deletedCount, String reason) {
        if (auditTrailService == null) {
            return;
        }
        AuditEventPayload payload = createBaseAuditPayload(action);
        Map<String, Object> details = new HashMap<>();
        details.put("stampIds", List.copyOf(ids));
        details.put("status", status);
        if (deletedCount != null) {
            details.put("deletedCount", deletedCount);
        }
        if (reason != null) {
            details.put("reason", reason);
        }
        enrichUserDetails(details);
        enrichTraceDetails(details);
        payload.setDetails(details);
        auditTrailService.record(payload);
    }

    void recordStampTreeReadAudit(String action, String facilityId, String visibility, List<PublishedTreeModel> models) {
        if (auditTrailService == null) {
            return;
        }
        try {
            AuditEventPayload payload = createBaseAuditPayload(action);
            Map<String, Object> details = new HashMap<>();
            details.put("facilityId", facilityId);
            details.put("visibility", visibility);
            details.put("resultCount", models != null ? models.size() : 0);
            enrichUserDetails(details);
            enrichTraceDetails(details);
            payload.setDetails(details);
            auditTrailService.record(payload);
        } catch (Exception ex) {
            LOGGER.log(Level.FINE, "Failed to write stamp tree read audit for action " + action, ex);
        }
    }

    List<PublishedTreeModel> fetchPublishedTrees(StampTreeVisibility visibility, String facilityId) {
        List<PublishedTreeModel> result;
        switch (visibility) {
            case PUBLIC -> result = stampServiceBean.getPublicTrees();
            case SHARED -> result = stampServiceBean.getSharedTrees(facilityId);
            case PUBLISHED -> result = stampServiceBean.getFacilityPublishedTrees(facilityId);
            default -> result = Collections.emptyList();
        }
        return result != null ? result : Collections.emptyList();
    }

    PublishedTreeListConverter toPublishedTreeResponse(List<PublishedTreeModel> models) {
        PublishedTreeList list = new PublishedTreeList();
        list.setList(models != null ? models : Collections.emptyList());
        PublishedTreeListConverter conv = new PublishedTreeListConverter();
        conv.setModel(list);
        return conv;
    }

    String validateFacilityAccess(String requestedFacility, StampTreeVisibility visibility) {
        String normalized = requestedFacility != null ? requestedFacility.trim() : null;
        String visibilitySegment = visibility.getSegment();
        if (normalized == null || normalized.isEmpty()) {
            throw invalidFacilityError("Facility identifier must not be empty", normalized, visibilitySegment);
        }
        String remoteUser = resolveRemoteUser();
        if (remoteUser == null || remoteUser.isEmpty()) {
            logAccessWarning("remote_user_missing", normalized, visibilitySegment, null);
            throw unauthorizedFacilityError("Remote user is not authenticated", normalized, visibilitySegment);
        }
        boolean admin = userServiceBean != null && userServiceBean.isAdmin(remoteUser);
        if (!admin) {
            String facilityOfUser = resource.getRemoteFacility(remoteUser);
            if (facilityOfUser == null || facilityOfUser.isEmpty()) {
                logAccessWarning("user_facility_missing", normalized, visibilitySegment, remoteUser);
                throw unauthorizedFacilityError("Authenticated user is not associated with a facility", normalized, visibilitySegment);
            }
            if (!facilityOfUser.equals(normalized)) {
                logAccessWarning("facility_mismatch", normalized, visibilitySegment, remoteUser);
                throw forbiddenFacilityError("Requested facility does not match authenticated facility", normalized, visibilitySegment);
            }
        }
        return normalized;
    }

    WebApplicationException badVisibilityError(String visibility) {
        String value = visibility == null ? "" : visibility;
        return buildErrorResponse(Response.Status.BAD_REQUEST, "bad_visibility", "Unsupported visibility: " + value, null, value);
    }

    void recordStampTreeAudit(String action,
                              StampTreeModel model,
                              String status,
                              String treeId,
                              String persistedVersion,
                              String reason,
                              String errorMessage) {
        if (auditTrailService == null) {
            return;
        }
        AuditEventPayload payload = createBaseAuditPayload(action);
        Map<String, Object> details = new HashMap<>();
        details.put("status", status);
        if (treeId != null) {
            details.put("treeId", treeId);
        } else if (model != null && model.getId() != 0) {
            details.put("treeId", String.valueOf(model.getId()));
        }
        if (model != null && model.getUserModel() != null) {
            details.put("userPk", model.getUserModel().getId());
            details.put("payloadVersion", model.getVersionNumber());
        }
        if (persistedVersion != null) {
            details.put("persistedVersion", persistedVersion);
        }
        if (reason != null) {
            details.put("reason", reason);
        }
        if (errorMessage != null && !errorMessage.isBlank()) {
            details.put("errorMessage", errorMessage);
        }
        enrichUserDetails(details);
        enrichTraceDetails(details);
        payload.setDetails(details);
        auditTrailService.record(payload);
    }

    void handleStampTreeFailure(String action, StampTreeModel model, RuntimeException e) {
        logStampTreeFailure(action, model, e);
        String errorMessage = (e.getMessage() == null || e.getMessage().isBlank())
                ? e.getClass().getSimpleName()
                : e.getMessage();
        recordStampTreeAudit(action, model, "failed", null, null, e.getClass().getSimpleName(), errorMessage);
    }

    private void ensureTreeBytes(StampTreeModel model) {
        if (model != null && (model.getTreeBytes() == null || model.getTreeBytes().length == 0) && model.getTreeXml() != null) {
            model.setTreeBytes(model.getTreeXml().getBytes(StandardCharsets.UTF_8));
        }
    }

    private AuditEventPayload createBaseAuditPayload(String action) {
        AuditEventPayload payload = new AuditEventPayload();
        String actorId = Optional.ofNullable(resolveRemoteUser()).orElse("system");
        payload.setActorId(actorId);
        payload.setActorDisplayName(resolveActorDisplayName(actorId));
        payload.setActorRole(resource.resolveActorRole(request, userServiceBean));
        payload.setAction(action);
        payload.setResource(resolveResourcePath());
        String requestId = resolveRequestId();
        String traceId = resource.resolveTraceId(request);
        if (traceId == null || traceId.isBlank()) {
            traceId = requestId;
        }
        payload.setRequestId(requestId);
        payload.setTraceId(traceId);
        payload.setIpAddress(request != null ? request.getRemoteAddr() : null);
        payload.setUserAgent(request != null ? request.getHeader("User-Agent") : null);
        return payload;
    }

    private void enrichUserDetails(Map<String, Object> details) {
        String remoteUser = resolveRemoteUser();
        if (remoteUser == null) {
            return;
        }
        details.put("remoteUser", remoteUser);
        int idx = remoteUser.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (idx > 0) {
            details.put("facilityId", remoteUser.substring(0, idx));
            if (idx + 1 < remoteUser.length()) {
                details.put("userId", remoteUser.substring(idx + 1));
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
            String traceId = resource.resolveTraceId(request);
            if (traceId != null) {
                details.put("traceId", traceId);
            }
        }
    }

    private void logAccessWarning(String reason, String facilityId, String visibility, String remoteUser) {
        LOGGER.log(Level.WARNING,
                "Stamp tree access blocked [traceId={0}, reason={1}, facilityId={2}, visibility={3}, remoteUser={4}]",
                new Object[]{resource.resolveTraceId(request), reason, facilityId, visibility, remoteUser});
    }

    private void logStampTreeFailure(String action, StampTreeModel model, RuntimeException e) {
        String traceId = resource.resolveTraceId(request);
        Long userPk = model != null && model.getUserModel() != null ? model.getUserModel().getId() : null;
        LOGGER.log(Level.WARNING, formatStampTreeFailureMessage(action, traceId, userPk, model), e);
    }

    private String formatStampTreeFailureMessage(String action, String traceId, Long userPk, StampTreeModel model) {
        return String.format("Stamp tree %s failed [traceId=%s, userPk=%s, version=%s]",
                action, traceId, userPk, model != null ? model.getVersionNumber() : null);
    }

    private String resolveActorDisplayName(String actorId) {
        if (actorId == null) {
            return "system";
        }
        int idx = actorId.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        return idx >= 0 && idx + 1 < actorId.length() ? actorId.substring(idx + 1) : actorId;
    }

    private String resolveResourcePath() {
        return request != null ? request.getRequestURI() : "/stamp";
    }

    private String resolveRequestId() {
        return request == null
                ? UUID.randomUUID().toString()
                : Optional.ofNullable(request.getHeader("X-Request-Id")).orElse(UUID.randomUUID().toString());
    }

    private String resolveRemoteUser() {
        return request != null ? request.getRemoteUser() : null;
    }

    private WebApplicationException invalidFacilityError(String message, String facilityId, String visibility) {
        return buildErrorResponse(Response.Status.BAD_REQUEST, "invalid_facility", message, facilityId, visibility);
    }

    private WebApplicationException unauthorizedFacilityError(String message, String facilityId, String visibility) {
        return buildErrorResponse(Response.Status.UNAUTHORIZED, "unauthorized", message, facilityId, visibility);
    }

    private WebApplicationException forbiddenFacilityError(String message, String facilityId, String visibility) {
        return buildErrorResponse(Response.Status.FORBIDDEN, "forbidden", message, facilityId, visibility);
    }

    private WebApplicationException buildErrorResponse(Response.Status status,
                                                       String errorCode,
                                                       String message,
                                                       String facilityId,
                                                       String visibility) {
        Map<String, Object> body = new HashMap<>();
        body.put("error", errorCode);
        body.put("code", errorCode);
        body.put("message", message);
        body.put("status", status.getStatusCode());
        String traceId = resource.resolveTraceId(request);
        if (traceId != null && !traceId.isEmpty()) {
            body.put("traceId", traceId);
        }
        body.put("path", resolveResourcePath());
        if (status == Response.Status.BAD_REQUEST) {
            body.put("validationError", Boolean.TRUE);
        }
        if (facilityId != null && !facilityId.isEmpty()) {
            body.put("facilityId", facilityId);
        }
        if (visibility != null && !visibility.isEmpty()) {
            body.put("visibility", visibility);
        }
        Response response = Response.status(status).entity(body).type(MediaType.APPLICATION_JSON).build();
        return new WebApplicationException(response);
    }

    enum StampTreeVisibility {
        PUBLIC("public", "STAMP_TREE_PUBLIC_GET"),
        SHARED("shared", "STAMP_TREE_SHARED_GET"),
        PUBLISHED("published", "STAMP_TREE_PUBLISHED_GET");

        private final String segment;
        private final String auditAction;

        StampTreeVisibility(String segment, String auditAction) {
            this.segment = segment;
            this.auditAction = auditAction;
        }

        String getSegment() {
            return segment;
        }

        String getAuditAction() {
            return auditAction;
        }

        static StampTreeVisibility from(String rawVisibility) {
            if (rawVisibility == null) {
                return null;
            }
            String normalized = rawVisibility.trim().toLowerCase(Locale.ROOT);
            for (StampTreeVisibility candidate : values()) {
                if (candidate.segment.equals(normalized)) {
                    return candidate;
                }
            }
            return null;
        }
    }
}

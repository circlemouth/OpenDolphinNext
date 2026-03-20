package open.dolphin.rest;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import open.dolphin.converter.PublishedTreeListConverter;
import open.dolphin.converter.StampListConverter;
import open.dolphin.converter.StampModelConverter;
import open.dolphin.converter.StampTreeHolderConverter;
import open.dolphin.infomodel.*;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.StampServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.session.framework.SessionTraceContext;
import open.dolphin.session.framework.SessionTraceManager;

/**
 * REST Web Service
 *
 * @author kazushi Minagawa, Digital Globe, Inc.
 */
@Path("/stamp")
public class StampResource extends AbstractResource {

    private static final Logger LOGGER = Logger.getLogger(StampResource.class.getName());

    @Inject
    private StampServiceBean stampServiceBean;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private AuditTrailService auditTrailService;

    @Inject
    private SessionTraceManager sessionTraceManager;

    @Context
    private HttpServletRequest httpServletRequest;

    /** Creates a new instance of StampResource */
    public StampResource() {
    }
    
    //----------------------------------------------------------------------
    
    @GET
    @Path("/tree/{userPK}")
    @Produces(MediaType.APPLICATION_JSON)
    public StampTreeHolderConverter getStampTree(@PathParam("userPK") String userPK) {

        long requestedUserPk = Long.parseLong(userPK);
        long actorUserPk = resolveActorUserPk();
        ensureActorOwnsUserPk(requestedUserPk, actorUserPk, "userPK");

        // IStampTreeModel=interface
        StampTreeHolder result = stampServiceBean.getTrees(actorUserPk);
        
        // Converter
        StampTreeHolderConverter conv = new StampTreeHolderConverter();
        conv.setModel(result);

        return conv;
    }

    @GET
    @Path("/tree/{facility}/{visibility}")
    @Produces(MediaType.APPLICATION_JSON)
    public PublishedTreeListConverter getFacilityStampTrees(@PathParam("facility") String facility,
            @PathParam("visibility") String visibility) {

        StampTreeVisibility resolvedVisibility = StampTreeVisibility.from(visibility);
        if (resolvedVisibility == null) {
            LOGGER.log(Level.WARNING, "Unsupported stamp tree visibility {0} [traceId={1}]",
                    new Object[]{visibility, resolveTraceId(httpServletRequest)});
            throw badVisibilityError(visibility);
        }

        String action = resolvedVisibility.getAuditAction();
        String normalizedFacility = validateFacilityAccess(facility, resolvedVisibility);
        List<PublishedTreeModel> models = fetchPublishedTrees(resolvedVisibility, normalizedFacility);
        PublishedTreeListConverter converter = toPublishedTreeResponse(models);
        recordStampTreeReadAudit(action, normalizedFacility, resolvedVisibility.getSegment(), models);
        return converter;
    }

    @PUT
    @Path("/tree")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String putTree(String json) throws IOException {
        StampTreeModel model = deserializeStampTree(json);
        UserModel actorUser = resolveActorUser();
        applyActorToTree(model, actorUser);
        try {
            long pk = stampServiceBean.putTreeForActor(model, actorUser.getId());
            String pkStr = String.valueOf(pk);
            recordStampTreeAudit("STAMP_TREE_PUT", model, "success", pkStr, null, null, null);
            debug(pkStr);
            return pkStr;
        } catch (RuntimeException e) {
            handleStampTreeFailure("STAMP_TREE_PUT", model, e);
            throw e;
        }
    }
    
    @PUT
    @Path("/tree/sync")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String syncTree(String json) throws IOException {
        StampTreeModel model = deserializeStampTree(json);
        UserModel actorUser = resolveActorUser();
        applyActorToTree(model, actorUser);
        try {
            String pkAndVersion = stampServiceBean.syncTreeForActor(model, actorUser.getId());
            String[] parsed = splitPkAndVersion(pkAndVersion);
            recordStampTreeAudit("STAMP_TREE_SYNC", model, "success", parsed[0], parsed[1], null, null);
            debug(pkAndVersion);
            return pkAndVersion;
        } catch (RuntimeException e) {
            handleStampTreeFailure("STAMP_TREE_SYNC", model, e);
            throw e;
        }
    }
    
    @PUT
    @Path("/tree/forcesync")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public void forceSyncTree(String json) throws IOException {
        StampTreeModel model = deserializeStampTree(json);
        UserModel actorUser = resolveActorUser();
        applyActorToTree(model, actorUser);
        try {
            stampServiceBean.forceSyncTreeForActor(model, actorUser.getId());
            recordStampTreeAudit("STAMP_TREE_FORCE_SYNC", model, "success",
                    model != null ? String.valueOf(model.getId()) : null, null, null, null);
        } catch (RuntimeException e) {
            handleStampTreeFailure("STAMP_TREE_FORCE_SYNC", model, e);
            throw e;
        }
    }

    //------------------------------------------------------------------
//    @POST
//    @Path("/published/tree")
//    @Consumes(MediaType.APPLICATION_JSON)
//    @Produces(MediaType.TEXT_PLAIN)
//    public String postPublishedTree(String json) throws IOException {
//
//        long pk = stampServiceBean.saveAndPublishTree(h);
//        String pkStr = String.valueOf(pk);
//        debug(pkStr);
//
//        return pkStr;
//    }

    @PUT
    @Path("/published/tree")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String putPublishedTree(String json) throws IOException {

        StampTreeHolder h = readJson(json, StampTreeHolder.class);
        UserModel actorUser = resolveActorUser();
        applyActorToTreeHolder(h, actorUser);

        String version = stampServiceBean.updatePublishedTreeForActor(h, actorUser.getId());
        debug(version);

        return version;
    }

    @PUT
    @Path("/published/cancel")
    @Consumes(MediaType.APPLICATION_JSON)
    public String cancelPublishedTree(String json) throws IOException {

        StampTreeModel model = readJson(json, StampTreeModel.class);
        UserModel actorUser = resolveActorUser();
        applyActorToTree(model, actorUser);
        
        String version = stampServiceBean.cancelPublishedTreeForActor(model, actorUser.getId());
        debug(version);
        
        return version;
    }

    @GET
    @Path("/published/tree")
    @Produces(MediaType.APPLICATION_JSON)
    public PublishedTreeListConverter getPublishedTrees(@Context HttpServletRequest servletReq) {
        
        String fid = getRemoteFacility(servletReq.getRemoteUser());
        List<PublishedTreeModel> result = stampServiceBean.getPublishedTrees(fid);
        PublishedTreeList list = new PublishedTreeList();
        list.setList(result);
        
        PublishedTreeListConverter conv = new PublishedTreeListConverter();
        conv.setModel(list);
        return conv;
    }

    //---------------------------------------------------------------
    @PUT
    @Path("/subscribed/tree")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String subscribeTrees(String json) throws IOException {

        SubscribedTreeList list = readJson(json, SubscribedTreeList.class);
        UserModel actorUser = resolveActorUser();
        applyActorToSubscribedTrees(list != null ? list.getList() : null, actorUser);
        
        List<Long> result = stampServiceBean.subscribeTreesForActor(list.getList(), actorUser.getId());

        StringBuilder sb = new StringBuilder();
        for (Long l : result) {
            sb.append(String.valueOf(l));
            sb.append(CAMMA);
        }
        String pks = sb.substring(0, sb.length()-1);
        debug(pks);

        return pks;
    }

    @DELETE
    @Path("/subscribed/tree/{idPks}")
    public void unsubscribeTrees(@PathParam("idPks") String idPks) {

        String[] params = idPks.split(CAMMA);
        List<Long> list = new ArrayList<Long>();
        long actorUserPk = resolveActorUserPk();
        for (String s : params) {
            list.add(Long.parseLong(s));
        }
        ensureUnsubscribeOwnership(list, actorUserPk);

        int cnt = stampServiceBean.unsubscribeTreesForActor(list, actorUserPk);
        
        String cntStr = String.valueOf(cnt);
        debug(cntStr);
    }
    
    //----------------------------------------------------------------------

    @GET
    @Path("/id/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public StampModelConverter getStamp(@PathParam("param") String param) {
        long actorUserPk = resolveActorUserPk();
        StampModel stamp = stampServiceBean.getStamp(param);
        ensureStampOwnership(stamp, actorUserPk, param);
        StampModelConverter conv = new StampModelConverter();
        conv.setModel(stamp);
        return conv;
    }
    
    @GET
    @Path("/list/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public StampListConverter getStamps(@PathParam("param") String param) {
        
        long actorUserPk = resolveActorUserPk();
        String[] params = param.split(CAMMA);
        List<String> list = new ArrayList<String>();
        list.addAll(Arrays.asList(params));

        List<StampModel> result = stampServiceBean.getStamp(list);
        ensureStampOwnership(result, list, actorUserPk);
        
        StampList list2 = new StampList();
        list2.setList(result);
        
        StampListConverter conv = new StampListConverter();
        conv.setModel(list2);

        return conv;
    }

    @PUT
    @Path("/id")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String putStamp(String json) throws IOException {

        StampModel model = readJson(json, StampModel.class);
        long actorUserPk = resolveActorUserPk();
        applyActorToStamp(model, actorUserPk);

        String ret = stampServiceBean.putStampForActor(model, actorUserPk);
        debug(ret);

        return ret;
    }

    @PUT
    @Path("/list")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String putStamps(String json) throws IOException {

        StampList list = readJson(json, StampList.class);
        long actorUserPk = resolveActorUserPk();
        applyActorToStamps(list != null ? list.getList() : null, actorUserPk);

        List<String> ret = stampServiceBean.putStampForActor(list.getList(), actorUserPk);

        StringBuilder sb = new StringBuilder();
        for (String str : ret) {
            sb.append(str);
            sb.append(",");
        }

        String retText = sb.substring(0, sb.length()-1);
        debug(retText);

        return retText;
    }


    @DELETE
    @Path("/id/{param}")
    public void deleteStamp(@PathParam("param") String param) {

        List<String> targetIds = List.of(param);
        long actorUserPk = resolveActorUserPk();
        StampModel existing = stampServiceBean.getStamp(param);
        ensureStampOwnership(existing, actorUserPk, param);
        if (existing == null) {
            String message = "Stamp not found: " + param;
            recordStampDeletionAudit("STAMP_DELETE_SINGLE", targetIds, "failed", null, "stamp_not_found", message);
            throw new NotFoundException(message);
        }

        try {
            int cnt = stampServiceBean.removeStamp(param);
            recordStampDeletionAudit("STAMP_DELETE_SINGLE", targetIds, "success", cnt, null, null);
            debug(String.valueOf(cnt));
        } catch (RuntimeException e) {
            String errorMessage = (e.getMessage() == null || e.getMessage().isBlank())
                    ? e.getClass().getSimpleName()
                    : e.getMessage();
            recordStampDeletionAudit("STAMP_DELETE_SINGLE", targetIds, "failed", null,
                    e.getClass().getSimpleName(), errorMessage);
            throw e;
        }
    }
    

    @DELETE
    @Path("/list/{param}")
    public void deleteStamps(@PathParam("param") String param) {

        long actorUserPk = resolveActorUserPk();
        String[] params = param.split(CAMMA);
        List<String> list = new ArrayList<String>();
        list.addAll(Arrays.asList(params));

        List<StampModel> resolved = stampServiceBean.getStamp(list);
        ensureStampOwnership(resolved, list, actorUserPk);
        List<String> missing = new ArrayList<>();
        for (int i = 0; i < list.size(); i++) {
            StampModel model = (resolved != null && resolved.size() > i) ? resolved.get(i) : null;
            if (model == null) {
                missing.add(list.get(i));
            }
        }
        if (!missing.isEmpty()) {
            String message = "Missing stamp ids: " + String.join(CAMMA, missing);
            recordStampDeletionAudit("STAMP_DELETE_BULK", list, "failed", null,
                    "missing_ids:" + String.join(CAMMA, missing), message);
            throw new NotFoundException(message);
        }

        try {
            int cnt = stampServiceBean.removeStamp(list);
            recordStampDeletionAudit("STAMP_DELETE_BULK", list, "success", cnt, null, null);
            debug(String.valueOf(cnt));
        } catch (RuntimeException e) {
            String errorMessage = (e.getMessage() == null || e.getMessage().isBlank())
                    ? e.getClass().getSimpleName()
                    : e.getMessage();
            recordStampDeletionAudit("STAMP_DELETE_BULK", list, "failed", null,
                    e.getClass().getSimpleName(), errorMessage);
            throw e;
        }
    }

    private void recordStampDeletionAudit(String action, List<String> ids, String status, Integer deletedCount,
                                          String reason, String errorMessage) {
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

    private void recordStampTreeReadAudit(String action, String facilityId, String visibility, List<PublishedTreeModel> models) {
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

    private List<PublishedTreeModel> fetchPublishedTrees(StampTreeVisibility visibility, String facilityId) {
        List<PublishedTreeModel> result;
        switch (visibility) {
            case PUBLIC:
                result = stampServiceBean.getPublicTrees();
                break;
            case SHARED:
                result = stampServiceBean.getSharedTrees(facilityId);
                break;
            case PUBLISHED:
            default:
                result = stampServiceBean.getFacilityPublishedTrees(facilityId);
                break;
        }
        return result != null ? result : Collections.emptyList();
    }

    private PublishedTreeListConverter toPublishedTreeResponse(List<PublishedTreeModel> models) {
        PublishedTreeList list = new PublishedTreeList();
        list.setList(models != null ? models : Collections.emptyList());
        PublishedTreeListConverter conv = new PublishedTreeListConverter();
        conv.setModel(list);
        return conv;
    }

    private String validateFacilityAccess(String requestedFacility, StampTreeVisibility visibility) {
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
            String facilityOfUser = getRemoteFacility(remoteUser);
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

    private void logAccessWarning(String reason, String facilityId, String visibility, String remoteUser) {
        LOGGER.log(Level.WARNING,
                "Stamp tree access blocked [traceId={0}, reason={1}, facilityId={2}, visibility={3}, remoteUser={4}]",
                new Object[]{resolveTraceId(httpServletRequest), reason, facilityId, visibility, remoteUser});
    }

    private WebApplicationException badVisibilityError(String visibility) {
        String value = visibility == null ? "" : visibility;
        return buildErrorResponse(Response.Status.BAD_REQUEST, "bad_visibility",
                "Unsupported visibility: " + value, null, value);
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

    private WebApplicationException buildErrorResponse(Response.Status status, String errorCode, String message,
            String facilityId, String visibility) {
        Map<String, Object> body = new HashMap<>();
        body.put("error", errorCode);
        body.put("code", errorCode);
        body.put("message", message);
        body.put("status", status.getStatusCode());
        String traceId = resolveTraceId(httpServletRequest);
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
        Response response = Response.status(status)
                .entity(body)
                .type(MediaType.APPLICATION_JSON)
                .build();
        return new WebApplicationException(response);
    }

    private void recordStampTreeAudit(String action, StampTreeModel model, String status, String treeId,
                                      String persistedVersion, String reason, String errorMessage) {
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

    private void handleStampTreeFailure(String action, StampTreeModel model, RuntimeException e) {
        logStampTreeFailure(action, model, e);
        String errorMessage = (e.getMessage() == null || e.getMessage().isBlank())
                ? e.getClass().getSimpleName()
                : e.getMessage();
        recordStampTreeAudit(action, model, "failed", null, null, e.getClass().getSimpleName(), errorMessage);
    }

    private void logStampTreeFailure(String action, StampTreeModel model, RuntimeException e) {
        String traceId = resolveTraceId(httpServletRequest);
        Long userPk = model != null && model.getUserModel() != null ? model.getUserModel().getId() : null;
        LOGGER.log(Level.WARNING, formatStampTreeFailureMessage(action, traceId, userPk, model), e);
    }

    private String formatStampTreeFailureMessage(String action, String traceId, Long userPk, StampTreeModel model) {
        return String.format("Stamp tree %s failed [traceId=%s, userPk=%s, version=%s]",
                action,
                traceId,
                userPk,
                model != null ? model.getVersionNumber() : null);
    }

    private StampTreeModel deserializeStampTree(String json) throws IOException {
        StampTreeModel model = readJson(json, StampTreeModel.class);
        ensureTreeBytes(model);
        return model;
    }

    private void ensureTreeBytes(StampTreeModel model) {
        if (model == null) {
            return;
        }
        if ((model.getTreeBytes() == null || model.getTreeBytes().length == 0) && model.getTreeXml() != null) {
            model.setTreeBytes(model.getTreeXml().getBytes(StandardCharsets.UTF_8));
        }
    }

    private UserModel resolveActorUser() {
        String remoteUser = resolveRemoteUser();
        if (remoteUser == null || remoteUser.isBlank()) {
            throw restError(httpServletRequest, Response.Status.UNAUTHORIZED, "unauthorized",
                    "Remote user is not authenticated", null, null);
        }
        try {
            UserModel actor = userServiceBean.getUser(remoteUser);
            if (actor == null || actor.getId() <= 0) {
                throw restError(httpServletRequest, Response.Status.UNAUTHORIZED, "unauthorized",
                        "Authenticated actor is invalid", Map.of("remoteUser", remoteUser), null);
            }
            return actor;
        } catch (WebApplicationException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw restError(httpServletRequest, Response.Status.UNAUTHORIZED, "unauthorized",
                    "Authenticated actor is invalid", Map.of("remoteUser", remoteUser), ex);
        }
    }

    private long resolveActorUserPk() {
        return resolveActorUser().getId();
    }

    private void ensureActorOwnsUserPk(long requestedUserPk, long actorUserPk, String fieldName) {
        if (requestedUserPk == actorUserPk) {
            return;
        }
        throw restError(httpServletRequest, Response.Status.FORBIDDEN, "forbidden", "Access denied",
                Map.of("requestedUserPk", requestedUserPk,
                        "actorUserPk", actorUserPk,
                        "field", fieldName),
                null);
    }

    private void applyActorToTree(StampTreeModel model, UserModel actorUser) {
        if (model == null || actorUser == null) {
            return;
        }
        model.setUserModel(actorUser);
    }

    private void applyActorToTreeHolder(StampTreeHolder holder, UserModel actorUser) {
        if (holder == null || actorUser == null) {
            return;
        }
        StampTreeModel personal = holder.getPersonalTree();
        if (personal != null) {
            applyActorToTree(personal, actorUser);
        }
        if (holder.getSubscribedList() == null) {
            return;
        }
        for (IStampTreeModel tree : holder.getSubscribedList()) {
            if (tree instanceof PublishedTreeModel published) {
                published.setUserModel(actorUser);
            }
        }
    }

    private void applyActorToSubscribedTrees(List<SubscribedTreeModel> models, UserModel actorUser) {
        if (models == null || actorUser == null) {
            return;
        }
        for (SubscribedTreeModel model : models) {
            if (model != null) {
                model.setUserModel(actorUser);
            }
        }
    }

    private void ensureUnsubscribeOwnership(List<Long> idPairs, long actorUserPk) {
        if (idPairs == null || idPairs.isEmpty()) {
            return;
        }
        if (idPairs.size() % 2 != 0) {
            throw restError(httpServletRequest, Response.Status.BAD_REQUEST, "invalid_request",
                    "idPks must be paired as treeId,userPK", Map.of("idPks", idPairs), null);
        }
        for (int i = 0; i < idPairs.size(); i += 2) {
            long requestedUserPk = idPairs.get(i + 1);
            ensureActorOwnsUserPk(requestedUserPk, actorUserPk, "unsubscribe.userPK");
        }
    }

    private void applyActorToStamp(StampModel stamp, long actorUserPk) {
        if (stamp != null) {
            stamp.setUserId(actorUserPk);
        }
    }

    private void applyActorToStamps(List<StampModel> stamps, long actorUserPk) {
        if (stamps == null) {
            return;
        }
        for (StampModel stamp : stamps) {
            applyActorToStamp(stamp, actorUserPk);
        }
    }

    private void ensureStampOwnership(StampModel stamp, long actorUserPk, String stampId) {
        if (stamp == null) {
            return;
        }
        if (stamp.getUserId() == actorUserPk) {
            return;
        }
        throw restError(httpServletRequest, Response.Status.FORBIDDEN, "forbidden", "Access denied",
                Map.of("stampId", stampId,
                        "requestedUserPk", stamp.getUserId(),
                        "actorUserPk", actorUserPk),
                null);
    }

    private void ensureStampOwnership(List<StampModel> stamps, List<String> ids, long actorUserPk) {
        if (stamps == null || ids == null) {
            return;
        }
        int upper = Math.min(stamps.size(), ids.size());
        for (int i = 0; i < upper; i++) {
            StampModel stamp = stamps.get(i);
            if (stamp == null) {
                continue;
            }
            ensureStampOwnership(stamp, actorUserPk, ids.get(i));
        }
    }

    private String[] splitPkAndVersion(String value) {
        if (value == null) {
            return new String[]{null, null};
        }
        String[] parts = value.split(CAMMA, 2);
        if (parts.length == 1) {
            return new String[]{parts[0], null};
        }
        return parts;
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
        payload.setIpAddress(resolveIpAddress());
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
        return httpServletRequest != null ? httpServletRequest.getRequestURI() : "/stamp";
    }

    private String resolveRequestId() {
        if (httpServletRequest == null) {
            return UUID.randomUUID().toString();
        }
        return Optional.ofNullable(httpServletRequest.getHeader("X-Request-Id")).orElse(UUID.randomUUID().toString());
    }

    private String resolveIpAddress() {
        return httpServletRequest != null ? httpServletRequest.getRemoteAddr() : null;
    }

    private String resolveUserAgent() {
        return httpServletRequest != null ? httpServletRequest.getHeader("User-Agent") : null;
    }

    private String resolveRemoteUser() {
        return httpServletRequest != null ? httpServletRequest.getRemoteUser() : null;
    }

    private enum StampTreeVisibility {
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

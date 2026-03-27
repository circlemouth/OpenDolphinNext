package open.dolphin.rest;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
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
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.StampServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.session.framework.SessionTraceManager;

/**
 * REST Web Service
 *
 * @author kazushi Minagawa, Digital Globe, Inc.
 */
@Path("/stamp")
public class StampResource extends AbstractResource {

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

    private StampResourceSupport support() {
        return new StampResourceSupport(
                this,
                httpServletRequest,
                userServiceBean,
                auditTrailService,
                sessionTraceManager,
                stampServiceBean);
    }

    /** Creates a new instance of StampResource */
    public StampResource() {
    }
    
    //----------------------------------------------------------------------
    
    @GET
    @Path("/tree/{userPK}")
    @Produces(MediaType.APPLICATION_JSON)
    public StampTreeHolderConverter getStampTree(@PathParam("userPK") String userPK) {

        long requestedUserPk = Long.parseLong(userPK);
        long actorUserPk = support().resolveActorUserPk();
        support().ensureActorOwnsUserPk(requestedUserPk, actorUserPk, "userPK");

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

        StampResourceSupport.StampTreeVisibility resolvedVisibility = StampResourceSupport.StampTreeVisibility.from(visibility);
        if (resolvedVisibility == null) {
            throw support().badVisibilityError(visibility);
        }

        String action = resolvedVisibility.getAuditAction();
        String normalizedFacility = support().validateFacilityAccess(facility, resolvedVisibility);
        List<PublishedTreeModel> models = support().fetchPublishedTrees(resolvedVisibility, normalizedFacility);
        PublishedTreeListConverter converter = support().toPublishedTreeResponse(models);
        support().recordStampTreeReadAudit(action, normalizedFacility, resolvedVisibility.getSegment(), models);
        return converter;
    }

    @PUT
    @Path("/tree")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String putTree(String json) throws IOException {
        StampTreeModel model = support().deserializeStampTree(this, json);
        UserModel actorUser = support().resolveActorUser();
        support().applyActorToTree(model, actorUser);
        try {
            long pk = stampServiceBean.putTreeForActor(model, actorUser.getId());
            String pkStr = String.valueOf(pk);
            support().recordStampTreeAudit("STAMP_TREE_PUT", model, "success", pkStr, null, null, null);
            debug(pkStr);
            return pkStr;
        } catch (RuntimeException e) {
            support().handleStampTreeFailure("STAMP_TREE_PUT", model, e);
            throw e;
        }
    }
    
    @PUT
    @Path("/tree/sync")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String syncTree(String json) throws IOException {
        StampTreeModel model = support().deserializeStampTree(this, json);
        UserModel actorUser = support().resolveActorUser();
        support().applyActorToTree(model, actorUser);
        try {
            String pkAndVersion = stampServiceBean.syncTreeForActor(model, actorUser.getId());
            String[] parsed = support().splitPkAndVersion(pkAndVersion);
            support().recordStampTreeAudit("STAMP_TREE_SYNC", model, "success", parsed[0], parsed[1], null, null);
            debug(pkAndVersion);
            return pkAndVersion;
        } catch (RuntimeException e) {
            support().handleStampTreeFailure("STAMP_TREE_SYNC", model, e);
            throw e;
        }
    }
    
    @PUT
    @Path("/tree/forcesync")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public void forceSyncTree(String json) throws IOException {
        StampTreeModel model = support().deserializeStampTree(this, json);
        UserModel actorUser = support().resolveActorUser();
        support().applyActorToTree(model, actorUser);
        try {
            stampServiceBean.forceSyncTreeForActor(model, actorUser.getId());
            support().recordStampTreeAudit("STAMP_TREE_FORCE_SYNC", model, "success",
                    model != null ? String.valueOf(model.getId()) : null, null, null, null);
        } catch (RuntimeException e) {
            support().handleStampTreeFailure("STAMP_TREE_FORCE_SYNC", model, e);
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
        UserModel actorUser = support().resolveActorUser();
        support().applyActorToTreeHolder(h, actorUser);

        String version = stampServiceBean.updatePublishedTreeForActor(h, actorUser.getId());
        debug(version);

        return version;
    }

    @PUT
    @Path("/published/cancel")
    @Consumes(MediaType.APPLICATION_JSON)
    public String cancelPublishedTree(String json) throws IOException {

        StampTreeModel model = readJson(json, StampTreeModel.class);
        UserModel actorUser = support().resolveActorUser();
        support().applyActorToTree(model, actorUser);
        
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
        UserModel actorUser = support().resolveActorUser();
        List<SubscribedTreeModel> trees = list != null ? list.getList() : null;
        if (trees == null) {
            throw restError(null, Response.Status.BAD_REQUEST, "invalid_request", "subscribed trees が必要です。");
        }
        support().applyActorToSubscribedTrees(trees, actorUser);
        
        List<Long> result = stampServiceBean.subscribeTreesForActor(trees, actorUser.getId());

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
        long actorUserPk = support().resolveActorUserPk();
        for (String s : params) {
            list.add(Long.parseLong(s));
        }
        support().ensureUnsubscribeOwnership(list, actorUserPk);

        int cnt = stampServiceBean.unsubscribeTreesForActor(list, actorUserPk);
        
        String cntStr = String.valueOf(cnt);
        debug(cntStr);
    }
    
    //----------------------------------------------------------------------

    @GET
    @Path("/id/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public StampModelConverter getStamp(@PathParam("param") String param) {
        long actorUserPk = support().resolveActorUserPk();
        StampModel stamp = stampServiceBean.getStamp(param);
        support().ensureStampOwnership(stamp, actorUserPk, param);
        StampModelConverter conv = new StampModelConverter();
        conv.setModel(stamp);
        return conv;
    }
    
    @GET
    @Path("/list/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public StampListConverter getStamps(@PathParam("param") String param) {
        
        long actorUserPk = support().resolveActorUserPk();
        String[] params = param.split(CAMMA);
        List<String> list = new ArrayList<String>();
        list.addAll(Arrays.asList(params));

        List<StampModel> result = stampServiceBean.getStamp(list);
        support().ensureStampOwnership(result, list, actorUserPk);
        
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
        long actorUserPk = support().resolveActorUserPk();
        support().applyActorToStamp(model, actorUserPk);

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
        long actorUserPk = support().resolveActorUserPk();
        List<StampModel> stamps = list != null ? list.getList() : null;
        if (stamps == null) {
            throw restError(null, Response.Status.BAD_REQUEST, "invalid_request", "stamps が必要です。");
        }
        support().applyActorToStamps(stamps, actorUserPk);

        List<String> ret = stampServiceBean.putStampForActor(stamps, actorUserPk);

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
        long actorUserPk = support().resolveActorUserPk();
        StampModel existing = stampServiceBean.getStamp(param);
        support().ensureStampOwnership(existing, actorUserPk, param);
        if (existing == null) {
            String message = "Stamp not found: " + param;
            support().recordStampDeletionAudit("STAMP_DELETE_SINGLE", targetIds, "failed", null, "stamp_not_found");
            throw new NotFoundException(message);
        }

        try {
            int cnt = stampServiceBean.removeStamp(param);
            support().recordStampDeletionAudit("STAMP_DELETE_SINGLE", targetIds, "success", cnt, null);
            debug(String.valueOf(cnt));
        } catch (RuntimeException e) {
            support().recordStampDeletionAudit("STAMP_DELETE_SINGLE", targetIds, "failed", null,
                    e.getClass().getSimpleName());
            throw e;
        }
    }
    

    @DELETE
    @Path("/list/{param}")
    public void deleteStamps(@PathParam("param") String param) {

        long actorUserPk = support().resolveActorUserPk();
        String[] params = param.split(CAMMA);
        List<String> list = new ArrayList<String>();
        list.addAll(Arrays.asList(params));

        List<StampModel> resolved = stampServiceBean.getStamp(list);
        support().ensureStampOwnership(resolved, list, actorUserPk);
        List<String> missing = new ArrayList<>();
        for (int i = 0; i < list.size(); i++) {
            StampModel model = (resolved != null && resolved.size() > i) ? resolved.get(i) : null;
            if (model == null) {
                missing.add(list.get(i));
            }
        }
        if (!missing.isEmpty()) {
            String message = "Missing stamp ids: " + String.join(CAMMA, missing);
            support().recordStampDeletionAudit("STAMP_DELETE_BULK", list, "failed", null,
                    "missing_ids:" + String.join(CAMMA, missing));
            throw new NotFoundException(message);
        }

        try {
            int cnt = stampServiceBean.removeStamp(list);
            support().recordStampDeletionAudit("STAMP_DELETE_BULK", list, "success", cnt, null);
            debug(String.valueOf(cnt));
        } catch (RuntimeException e) {
            support().recordStampDeletionAudit("STAMP_DELETE_BULK", list, "failed", null,
                    e.getClass().getSimpleName());
            throw e;
        }
    }
}

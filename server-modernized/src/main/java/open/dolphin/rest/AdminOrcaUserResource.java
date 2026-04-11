package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.persistence.query.OrcaUserLinkQueryService;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.security.auth.AdminStepUpGuard;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;

/**
 * Administration APIs for ORCA user management and EHR-ORCA user linking.
 */
@Path("/admin")
public class AdminOrcaUserResource extends AbstractResource {

    @PersistenceContext
    private EntityManager em;

    @Inject
    private OrcaTransport orcaTransport;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    private AdminStepUpGuard adminStepUpGuard;

    private volatile AdminOrcaUserSupport.SyncState syncState = AdminOrcaUserSupport.SyncState.idle();

    @GET
    @Path("/orca/users")
    @Produces(MediaType.APPLICATION_JSON)
    public Response listOrcaUsers(@Context HttpServletRequest request) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request);
        String facilityId = getRemoteFacility(actor);

        AdminOrcaUserSupport.ManageUsersResult result = fetchOrcaUsers(request, runId);
        Map<String, Map<String, Object>> linkByOrcaUser = loadLinkByOrcaUser(facilityId);

        List<Map<String, Object>> users = new ArrayList<>();
        for (AdminOrcaUserSupport.OrcaUserSnapshot user : result.users()) {
            String key = AdminOrcaUserSupport.normalizeToken(user.userId());
            users.add(AdminOrcaUserSupport.toUserPayload(user, key != null ? linkByOrcaUser.get(key) : null));
        }

        Map<String, Object> body =
                AdminOrcaUserSupport.baseEnvelope(runId, request, result.apiResult(), result.apiResultMessage(), true);
        body.put("status", Response.Status.OK.getStatusCode());
        body.put("users", users);
        body.put("syncStatus", AdminOrcaUserSupport.toSyncStatusPayload(syncState));

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("operation", "list");
        details.put("usersReturned", users.size());
        details.put("apiResult", result.apiResult());
        details.put("apiResultMessage", result.apiResultMessage());
        recordAudit(request, "ADMIN_ORCA_USERS_LIST", actor, runId, details,
                AuditEventEnvelope.Outcome.SUCCESS, null, null);

        return Response.ok(body).header("x-run-id", runId).build();
    }

    @POST
    @Path("/orca/sync")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response syncOrcaUsers(@Context HttpServletRequest request, Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request);
        adminStepUpGuard.require(request, "admin:mutation");

        syncState = syncState.withRunning(true);
        try {
            AdminOrcaUserSupport.ManageUsersResult result = fetchOrcaUsers(request, runId);
            AdminOrcaUserSupport.SyncState updated = AdminOrcaUserSupport.SyncState.completed(result.users().size());
            syncState = updated;

            Map<String, Object> body =
                    AdminOrcaUserSupport.baseEnvelope(runId, request, result.apiResult(), result.apiResultMessage(), true);
            body.put("status", Response.Status.OK.getStatusCode());
            body.put("syncStatus", AdminOrcaUserSupport.toSyncStatusPayload(updated));

            Map<String, Object> details = new LinkedHashMap<>();
            details.put("operation", "sync");
            details.put("syncedCount", result.users().size());
            details.put("apiResult", result.apiResult());
            details.put("apiResultMessage", result.apiResultMessage());
            recordAudit(request, "ADMIN_ORCA_USERS_SYNC", actor, runId, details,
                    AuditEventEnvelope.Outcome.SUCCESS, null, null);

            return Response.ok(body).header("x-run-id", runId).build();
        } catch (RuntimeException ex) {
            AdminOrcaUserSupport.SyncState current = syncState;
            syncState = new AdminOrcaUserSupport.SyncState(
                    false, current.lastSyncedAt(), current.syncedCount(), AdminOrcaUserSupport.summarizeError(ex));
            throw ex;
        }
    }

    @POST
    @Path("/orca/users")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response createOrcaUser(@Context HttpServletRequest request, Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request);
        adminStepUpGuard.require(request, "admin:mutation");

        String userId = AdminOrcaUserSupport.requiredOrcaUserId(this, request, payload, "userId", "User_Id");
        String password = AdminOrcaUserSupport.requiredToken(this, request, payload, "password", "Password");
        String staffClass = AdminOrcaUserSupport.requiredToken(this, request, payload, "staffClass", "Staff_Class");
        String fullName = AdminOrcaUserSupport.requiredToken(this, request, payload, "fullName", "WholeName");
        String fullNameKana = AdminOrcaUserSupport.optionalToken(payload, "fullNameKana", "WholeName_inKana", "kanaName", "Kana_Name");
        Boolean isAdmin = AdminOrcaUserSupport.optionalBoolean(payload, "isAdmin", "Admin_Flag", "admin");

        AdminOrcaUserSupport.ManageUsersResult result = invokeManageUsers(
                request,
                runId,
                AdminOrcaUserSupport.buildCreateRequestXml(
                        userId, password, staffClass, fullName, fullNameKana, isAdmin));
        AdminOrcaUserSupport.ensureManageUsersSuccess(this, request, result);

        AdminOrcaUserSupport.ManageUsersResult refreshed = fetchOrcaUsers(request, runId);

        Map<String, Object> body =
                AdminOrcaUserSupport.baseEnvelope(runId, request, refreshed.apiResult(), refreshed.apiResultMessage(), true);
        body.put("status", Response.Status.OK.getStatusCode());
        body.put("user", AdminOrcaUserSupport.toUserPayload(
                AdminOrcaUserSupport.findUser(refreshed.users(), userId), null));
        body.put("syncStatus", AdminOrcaUserSupport.toSyncStatusPayload(syncState));

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("operation", "create");
        details.put("userId", userId);
        details.put("apiResult", refreshed.apiResult());
        details.put("apiResultMessage", refreshed.apiResultMessage());
        recordAudit(request, "ADMIN_ORCA_USERS_CREATE", actor, runId, details,
                AuditEventEnvelope.Outcome.SUCCESS, null, null);

        return Response.ok(body).header("x-run-id", runId).build();
    }

    @PUT
    @Path("/orca/users/{orcaUserId}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response updateOrcaUser(@Context HttpServletRequest request,
                                   @PathParam("orcaUserId") String orcaUserId,
                                   Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request);
        adminStepUpGuard.require(request, "admin:mutation");

        String currentUserId = requireValidUserId(request, orcaUserId);
        String newPassword = AdminOrcaUserSupport.optionalToken(payload, "password", "Password");
        String newFullName = AdminOrcaUserSupport.optionalToken(payload, "fullName", "WholeName");
        String newFullNameKana = AdminOrcaUserSupport.optionalToken(payload, "fullNameKana", "WholeName_inKana", "newKanaName", "New_Kana_Name");
        boolean newAdminSpecified = AdminOrcaUserSupport.hasAnyKey(payload, "isAdmin", "Admin_Flag");
        Boolean newAdmin = newAdminSpecified ? AdminOrcaUserSupport.optionalBoolean(payload, "isAdmin", "Admin_Flag") : null;

        if (newPassword == null && newFullName == null && newFullNameKana == null && !newAdminSpecified) {
            throw restError(request, Response.Status.BAD_REQUEST, "update_required", "更新項目が指定されていません。");
        }

        AdminOrcaUserSupport.ManageUsersResult result = invokeManageUsers(
                request,
                runId,
                AdminOrcaUserSupport.buildUpdateRequestXml(
                        currentUserId, newPassword, newFullName, newFullNameKana, newAdmin));
        AdminOrcaUserSupport.ensureManageUsersSuccess(this, request, result);

        Map<String, Object> body =
                AdminOrcaUserSupport.baseEnvelope(runId, request, result.apiResult(), result.apiResultMessage(), true);
        body.put("status", Response.Status.OK.getStatusCode());
        body.put("user", AdminOrcaUserSupport.toUserPayload(
                AdminOrcaUserSupport.findUser(result.users(), currentUserId), null));
        body.put("syncStatus", AdminOrcaUserSupport.toSyncStatusPayload(syncState));

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("operation", "update");
        details.put("currentUserId", currentUserId);
        details.put("apiResult", result.apiResult());
        details.put("apiResultMessage", result.apiResultMessage());
        recordAudit(request, "ADMIN_ORCA_USERS_UPDATE", actor, runId, details,
                AuditEventEnvelope.Outcome.SUCCESS, null, null);

        return Response.ok(body).header("x-run-id", runId).build();
    }

    @DELETE
    @Path("/orca/users/{orcaUserId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Transactional
    public Response deleteOrcaUser(@Context HttpServletRequest request,
                                   @PathParam("orcaUserId") String orcaUserId) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request);
        adminStepUpGuard.require(request, "admin:mutation");
        String facilityId = getRemoteFacility(actor);
        String userId = requireValidUserId(request, orcaUserId);

        AdminOrcaUserSupport.ManageUsersResult result =
                invokeManageUsers(request, runId, AdminOrcaUserSupport.buildDeleteRequestXml(userId));
        AdminOrcaUserSupport.ensureManageUsersSuccess(this, request, result);

        if (isLinkTablePresent()) {
            orcaUserLinks().deleteByOrcaUserId(facilityId, userId);
        }

        Map<String, Object> body =
                AdminOrcaUserSupport.baseEnvelope(runId, request, result.apiResult(), result.apiResultMessage(), true);
        body.put("status", Response.Status.OK.getStatusCode());
        body.put("user", Map.of("userId", userId));
        body.put("syncStatus", AdminOrcaUserSupport.toSyncStatusPayload(syncState));

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("operation", "delete");
        details.put("userId", userId);
        details.put("apiResult", result.apiResult());
        details.put("apiResultMessage", result.apiResultMessage());
        recordAudit(request, "ADMIN_ORCA_USERS_DELETE", actor, runId, details,
                AuditEventEnvelope.Outcome.SUCCESS, null, null);

        return Response.ok(body).header("x-run-id", runId).build();
    }

    public Response linkEhrUserToOrca(@Context HttpServletRequest request,
                                      @PathParam("ehrUserId") String ehrUserId,
                                      Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request);
        adminStepUpGuard.require(request, "admin:mutation");
        String facilityId = getRemoteFacility(actor);
        requireLinkTableAvailable(request);

        String orcaUserId = AdminOrcaUserSupport.requiredOrcaUserId(this, request, payload, "orcaUserId", "userId", "User_Id");
        UserModel ehrUser = resolveEhrUser(request, facilityId, ehrUserId);
        AdminOrcaUserSupport.ManageUsersResult usersResult = fetchOrcaUsers(request, runId);
        boolean exists = usersResult.users().stream()
                .map(AdminOrcaUserSupport.OrcaUserSnapshot::userId)
                .map(AdminOrcaUserSupport::normalizeToken)
                .filter(Objects::nonNull)
                .anyMatch(orcaUserId::equals);
        if (!exists) {
            throw restError(request, Response.Status.NOT_FOUND, "orca_user_not_found", "指定した ORCA User_Id が見つかりません。");
        }

        Long existingOwner = findOwnerByOrcaUserId(facilityId, orcaUserId);
        if (existingOwner != null && existingOwner.longValue() != ehrUser.getId()) {
            throw restError(request, Response.Status.CONFLICT, "orca_user_already_linked",
                    "指定した ORCA User_Id は別の電子カルテユーザーにリンク済みです。");
        }

        orcaUserLinks().upsertLink(facilityId, ehrUser.getId(), orcaUserId, Instant.now(), actor);

        Map<String, Object> body = AdminOrcaUserSupport.baseEnvelope(runId, request, "0000", "linked", true);
        body.put("status", Response.Status.OK.getStatusCode());
        body.put("user", Map.of("userId", orcaUserId));
        body.put("syncStatus", AdminOrcaUserSupport.toSyncStatusPayload(syncState));

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("operation", "link");
        details.put("ehrUserId", ehrUser.getUserId());
        details.put("orcaUserId", orcaUserId);
        recordAudit(request, "ADMIN_ORCA_USERS_LINK", actor, runId, details,
                AuditEventEnvelope.Outcome.SUCCESS, null, null);

        return Response.ok(body).header("x-run-id", runId).build();
    }

    public Response unlinkEhrUserFromOrca(@Context HttpServletRequest request,
                                          @PathParam("ehrUserId") String ehrUserId) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request);
        adminStepUpGuard.require(request, "admin:mutation");
        String facilityId = getRemoteFacility(actor);
        requireLinkTableAvailable(request);

        UserModel ehrUser = resolveEhrUser(request, facilityId, ehrUserId);
        orcaUserLinks().deleteByEhrUserPk(facilityId, ehrUser.getId());

        Map<String, Object> body = AdminOrcaUserSupport.baseEnvelope(runId, request, "0000", "unlinked", true);
        body.put("status", Response.Status.OK.getStatusCode());
        body.put("syncStatus", AdminOrcaUserSupport.toSyncStatusPayload(syncState));

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("operation", "unlink");
        details.put("ehrUserId", ehrUser.getUserId());
        recordAudit(request, "ADMIN_ORCA_USERS_UNLINK", actor, runId, details,
                AuditEventEnvelope.Outcome.SUCCESS, null, null);

        return Response.ok(body).header("x-run-id", runId).build();
    }

    private String requireAdminActor(HttpServletRequest request) {
        return AdminResourceSupport.requireAdminActor(this, request, userServiceBean);
    }

    private AdminOrcaUserSupport.ManageUsersResult fetchOrcaUsers(HttpServletRequest request, String runId) {
        AdminOrcaUserSupport.ManageUsersResult result =
                invokeManageUsers(request, runId, AdminOrcaUserSupport.buildListRequestXml());
        AdminOrcaUserSupport.ensureManageUsersSuccess(this, request, result);
        return result;
    }

    private AdminOrcaUserSupport.ManageUsersResult invokeManageUsers(HttpServletRequest request, String runId, String requestXml) {
        if (orcaTransport == null) {
            throw restError(request, Response.Status.SERVICE_UNAVAILABLE,
                    "orca_transport_unavailable", "ORCA transport が利用できません。");
        }
        try {
            String facilityId = getRemoteFacility(request != null ? request.getRemoteUser() : null);
            OrcaTransportResult response = orcaTransport.invoke(
                    facilityId,
                    OrcaEndpoint.MANAGE_USERS,
                    OrcaTransportRequest.post(requestXml));
            return AdminOrcaUserSupport.parseManageUsersResult(response);
        } catch (RuntimeException ex) {
            if (ex instanceof OrcaGatewayException) {
                throw restError(request, Response.Status.BAD_GATEWAY,
                        "orca_gateway_error", ex.getMessage() != null ? ex.getMessage() : "ORCA 呼び出しに失敗しました。");
            }
            throw ex;
        }
    }

    private Map<String, Map<String, Object>> loadLinkByOrcaUser(String facilityId) {
        if (em == null || facilityId == null || facilityId.isBlank() || !isLinkTablePresent()) {
            return Map.of();
        }
        Map<String, OrcaUserLinkQueryService.OrcaFacilityLinkRow> rows =
                orcaUserLinks().findLinksByFacilityId(facilityId);
        Map<String, Map<String, Object>> map = new LinkedHashMap<>();
        for (OrcaUserLinkQueryService.OrcaFacilityLinkRow row : rows.values()) {
            if (row == null) {
                continue;
            }
            String orcaUserId = AdminOrcaUserSupport.normalizeToken(row.orcaUserId());
            String ehrUserId = AdminOrcaUserSupport.normalizeToken(row.ehrUserId());
            if (orcaUserId == null || ehrUserId == null) {
                continue;
            }
            Map<String, Object> link = new LinkedHashMap<>();
            link.put("linked", Boolean.TRUE);
            link.put("ehrUserId", ehrUserId);
            link.put("ehrLoginId", AdminOrcaUserSupport.extractLoginId(ehrUserId));
            link.put("ehrDisplayName", AdminOrcaUserSupport.normalizeToken(row.ehrDisplayName()));
            map.put(orcaUserId, link);
        }
        return map;
    }

    private UserModel resolveEhrUser(HttpServletRequest request, String facilityId, String ehrUserId) {
        if (em == null) {
            throw restError(request, Response.Status.SERVICE_UNAVAILABLE, "entity_manager_unavailable", "DB 接続が利用できません。");
        }
        String token = AdminOrcaUserSupport.normalizeToken(ehrUserId);
        if (token == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "ehr_user_required", "電子カルテユーザーIDが必要です。");
        }

        String target = token.contains(IInfoModel.COMPOSITE_KEY_MAKER)
                ? token
                : facilityId + IInfoModel.COMPOSITE_KEY_MAKER + token;
        UserModel user = userServiceBean != null ? userServiceBean.getUser(target) : null;
        if (user == null || user.getId() <= 0) {
            throw restError(request, Response.Status.NOT_FOUND, "ehr_user_not_found", "指定した電子カルテユーザーが見つかりません。");
        }
        String userFacility = getRemoteFacility(user.getUserId());
        if (!Objects.equals(facilityId, userFacility)) {
            throw restError(request, Response.Status.FORBIDDEN, "forbidden", "施設外ユーザーは指定できません。");
        }
        return user;
    }

    private void requireLinkTableAvailable(HttpServletRequest request) {
        if (!isLinkTablePresent()) {
            throw restError(request, Response.Status.SERVICE_UNAVAILABLE,
                    "link_table_unavailable", "ORCA ユーザー連携テーブルが利用できません。");
        }
    }

    private boolean isLinkTablePresent() {
        return em != null && orcaUserLinks().isLinkTablePresent();
    }

    private Long findOwnerByOrcaUserId(String facilityId, String orcaUserId) {
        return em == null || !isLinkTablePresent() ? null : orcaUserLinks().findOwnerByOrcaUserId(facilityId, orcaUserId);
    }

    private OrcaUserLinkQueryService orcaUserLinks() {
        return new OrcaUserLinkQueryService(() -> em);
    }

    private String requireValidUserId(HttpServletRequest request, String orcaUserId) {
        String userId = AdminOrcaUserSupport.normalizeToken(orcaUserId);
        if (userId == null || !userId.matches("^[A-Za-z0-9_]+$")) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_user_id", "ORCA User_Id が不正です。");
        }
        return userId;
    }

    private void recordAudit(HttpServletRequest request,
                             String action,
                             String actor,
                             String runId,
                             Map<String, Object> details,
                             AuditEventEnvelope.Outcome outcome,
                             String errorCode,
                             String errorMessage) {
        AdminResourceSupport.recordAudit(
                this,
                sessionAuditDispatcher,
                request,
                action,
                actor,
                runId,
                details,
                outcome,
                errorCode,
                errorMessage,
                "/api/admin/orca/users");
    }
}

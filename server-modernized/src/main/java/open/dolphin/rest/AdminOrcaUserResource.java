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
import java.io.StringReader;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
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
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

/**
 * Administration APIs for ORCA user management and EHR-ORCA user linking.
 */
@Path("/admin")
public class AdminOrcaUserResource extends AbstractResource {

    private static final Logger LOGGER = Logger.getLogger(AdminOrcaUserResource.class.getName());
    private static final Pattern API_RESULT_PATTERN =
            Pattern.compile("<Api_Result\\b[^>]*>(.*?)</Api_Result>", Pattern.DOTALL);
    private static final Pattern API_MESSAGE_PATTERN =
            Pattern.compile("<Api_Result_Message\\b[^>]*>(.*?)</Api_Result_Message>", Pattern.DOTALL);
    private static final Pattern USER_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_]+$");

    @PersistenceContext
    private EntityManager em;

    @Inject
    private OrcaTransport orcaTransport;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    private final AtomicReference<SyncState> syncStateRef = new AtomicReference<>(SyncState.idle());

    @GET
    @Path("/orca/users")
    @Produces(MediaType.APPLICATION_JSON)
    public Response listOrcaUsers(@Context HttpServletRequest request) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        String facilityId = getRemoteFacility(actor);

        ManageUsersResult result = fetchOrcaUsers(request, runId);
        Map<String, Map<String, Object>> linkByOrcaUser = loadLinkByOrcaUser(facilityId);

        List<Map<String, Object>> users = new ArrayList<>();
        for (OrcaUserSnapshot user : result.users()) {
            String key = normalizeToken(user.userId());
            users.add(toUserPayload(user, key != null ? linkByOrcaUser.get(key) : null));
        }

        Map<String, Object> body = baseEnvelope(runId, request, result.apiResult(), result.apiResultMessage(), true);
        body.put("status", Response.Status.OK.getStatusCode());
        body.put("users", users);
        body.put("syncStatus", toSyncStatusPayload(syncStateRef.get()));

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
        String actor = requireAdminActor(request, runId);

        syncStateRef.set(syncStateRef.get().withRunning(true));
        try {
            ManageUsersResult result = fetchOrcaUsers(request, runId);
            SyncState updated = new SyncState(false, Instant.now().toString(), result.users().size(), null);
            syncStateRef.set(updated);

            Map<String, Object> body = baseEnvelope(runId, request, result.apiResult(), result.apiResultMessage(), true);
            body.put("status", Response.Status.OK.getStatusCode());
            body.put("syncStatus", toSyncStatusPayload(updated));

            Map<String, Object> details = new LinkedHashMap<>();
            details.put("operation", "sync");
            details.put("syncedCount", result.users().size());
            details.put("apiResult", result.apiResult());
            details.put("apiResultMessage", result.apiResultMessage());
            recordAudit(request, "ADMIN_ORCA_USERS_SYNC", actor, runId, details,
                    AuditEventEnvelope.Outcome.SUCCESS, null, null);

            return Response.ok(body).header("x-run-id", runId).build();
        } catch (RuntimeException ex) {
            SyncState current = syncStateRef.get();
            syncStateRef.set(new SyncState(false, current.lastSyncedAt(), current.syncedCount(), summarizeError(ex)));
            throw ex;
        }
    }

    @POST
    @Path("/orca/users")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response createOrcaUser(@Context HttpServletRequest request, Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);

        String userId = requiredOrcaUserId(request, payload, "userId", "User_Id");
        String password = requiredToken(request, payload, "password", "Password");
        String staffClass = requiredToken(request, payload, "staffClass", "Staff_Class");
        String fullName = requiredToken(request, payload, "fullName", "WholeName");
        String fullNameKana = optionalToken(payload, "fullNameKana", "WholeName_inKana", "kanaName", "Kana_Name");
        String staffNumber = optionalToken(payload, "staffNumber", "Staff_Number", "userNumber", "User_Number");
        Boolean isAdmin = optionalBoolean(payload, "isAdmin", "Admin_Flag", "admin");

        String requestXml = buildCreateRequestXml(userId, password, staffClass, fullName, fullNameKana, staffNumber, isAdmin);
        ManageUsersResult result = invokeManageUsers(request, runId, requestXml);
        ensureManageUsersSuccess(request, result);

        OrcaUserSnapshot snapshot = findUser(result.users(), userId);
        Map<String, Object> body = baseEnvelope(runId, request, result.apiResult(), result.apiResultMessage(), true);
        body.put("status", Response.Status.OK.getStatusCode());
        body.put("user", toUserPayload(snapshot, null));
        body.put("syncStatus", toSyncStatusPayload(syncStateRef.get()));

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("operation", "create");
        details.put("userId", userId);
        details.put("apiResult", result.apiResult());
        details.put("apiResultMessage", result.apiResultMessage());
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
        String actor = requireAdminActor(request, runId);

        String currentUserId = normalizeToken(orcaUserId);
        if (currentUserId == null || !USER_ID_PATTERN.matcher(currentUserId).matches()) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_user_id", "ORCA User_Id が不正です。");
        }

        String newUserId = optionalToken(payload, "userId", "User_Id", "newUserId");
        String newPassword = optionalToken(payload, "password", "Password");
        String newStaffClass = optionalToken(payload, "staffClass", "Staff_Class");
        String newFullName = optionalToken(payload, "fullName", "WholeName");
        String newFullNameKana = optionalToken(payload, "fullNameKana", "WholeName_inKana", "newKanaName", "New_Kana_Name");
        String newStaffNumber = optionalToken(payload, "staffNumber", "Staff_Number", "newUserNumber");
        Boolean newAdmin = optionalBoolean(payload, "isAdmin", "Admin_Flag");

        if (newUserId != null && !USER_ID_PATTERN.matcher(newUserId).matches()) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_user_id", "ORCA User_Id が不正です。");
        }

        if (newUserId == null && newPassword == null && newStaffClass == null
                && newFullName == null && newFullNameKana == null && newStaffNumber == null && newAdmin == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "update_required", "更新項目が指定されていません。");
        }

        String requestXml = buildUpdateRequestXml(currentUserId, newUserId, newPassword, newStaffClass,
                newFullName, newFullNameKana, newStaffNumber, newAdmin);
        ManageUsersResult result = invokeManageUsers(request, runId, requestXml);
        ensureManageUsersSuccess(request, result);

        String effectiveUserId = newUserId != null ? newUserId : currentUserId;
        OrcaUserSnapshot snapshot = findUser(result.users(), effectiveUserId);
        Map<String, Object> body = baseEnvelope(runId, request, result.apiResult(), result.apiResultMessage(), true);
        body.put("status", Response.Status.OK.getStatusCode());
        body.put("user", toUserPayload(snapshot, null));
        body.put("syncStatus", toSyncStatusPayload(syncStateRef.get()));

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("operation", "update");
        details.put("currentUserId", currentUserId);
        details.put("newUserId", newUserId);
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
        String actor = requireAdminActor(request, runId);
        String facilityId = getRemoteFacility(actor);

        String userId = normalizeToken(orcaUserId);
        if (userId == null || !USER_ID_PATTERN.matcher(userId).matches()) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_user_id", "ORCA User_Id が不正です。");
        }

        String requestXml = buildDeleteRequestXml(userId);
        ManageUsersResult result = invokeManageUsers(request, runId, requestXml);
        ensureManageUsersSuccess(request, result);

        if (isLinkTablePresent()) {
            orcaUserLinks().deleteByOrcaUserIdAndFacilityPrefix(
                    userId,
                    facilityId + IInfoModel.COMPOSITE_KEY_MAKER + "%");
        }

        Map<String, Object> body = baseEnvelope(runId, request, result.apiResult(), result.apiResultMessage(), true);
        body.put("status", Response.Status.OK.getStatusCode());
        body.put("user", Map.of("userId", userId));
        body.put("syncStatus", toSyncStatusPayload(syncStateRef.get()));

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
        String actor = requireAdminActor(request, runId);
        String facilityId = getRemoteFacility(actor);
        requireLinkTableAvailable(request);

        String orcaUserId = requiredOrcaUserId(request, payload, "orcaUserId", "userId", "User_Id");
        UserModel ehrUser = resolveEhrUser(request, facilityId, ehrUserId);

        ManageUsersResult usersResult = fetchOrcaUsers(request, runId);
        boolean exists = usersResult.users().stream()
                .map(OrcaUserSnapshot::userId)
                .map(this::normalizeToken)
                .filter(Objects::nonNull)
                .anyMatch(orcaUserId::equals);
        if (!exists) {
            throw restError(request, Response.Status.NOT_FOUND, "orca_user_not_found", "指定した ORCA User_Id が見つかりません。");
        }

        Long existingOwner = findOwnerByOrcaUserId(orcaUserId);
        if (existingOwner != null && existingOwner.longValue() != ehrUser.getId()) {
            throw restError(request, Response.Status.CONFLICT, "orca_user_already_linked",
                    "指定した ORCA User_Id は別の電子カルテユーザーにリンク済みです。");
        }

        Instant now = Instant.now();
        orcaUserLinks().upsertLink(ehrUser.getId(), orcaUserId, now, actor);

        Map<String, Object> body = baseEnvelope(runId, request, "0000", "linked", true);
        body.put("status", Response.Status.OK.getStatusCode());
        body.put("user", Map.of("userId", orcaUserId));
        body.put("syncStatus", toSyncStatusPayload(syncStateRef.get()));

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
        String actor = requireAdminActor(request, runId);
        String facilityId = getRemoteFacility(actor);
        requireLinkTableAvailable(request);

        UserModel ehrUser = resolveEhrUser(request, facilityId, ehrUserId);
        orcaUserLinks().deleteByEhrUserPk(ehrUser.getId());

        Map<String, Object> body = baseEnvelope(runId, request, "0000", "unlinked", true);
        body.put("status", Response.Status.OK.getStatusCode());
        body.put("syncStatus", toSyncStatusPayload(syncStateRef.get()));

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("operation", "unlink");
        details.put("ehrUserId", ehrUser.getUserId());
        recordAudit(request, "ADMIN_ORCA_USERS_UNLINK", actor, runId, details,
                AuditEventEnvelope.Outcome.SUCCESS, null, null);

        return Response.ok(body).header("x-run-id", runId).build();
    }

    private String requireAdminActor(HttpServletRequest request, String runId) {
        return AdminResourceSupport.requireAdminActor(this, request, userServiceBean);
    }

    private ManageUsersResult fetchOrcaUsers(HttpServletRequest request, String runId) {
        String requestXml = "<data><manageusersreq type=\"record\"><Request_Number type=\"string\">01</Request_Number></manageusersreq></data>";
        ManageUsersResult result = invokeManageUsers(request, runId, requestXml);
        ensureManageUsersSuccess(request, result);
        return result;
    }

    private ManageUsersResult invokeManageUsers(HttpServletRequest request, String runId, String requestXml) {
        if (orcaTransport == null) {
            throw restError(request, Response.Status.SERVICE_UNAVAILABLE,
                    "orca_transport_unavailable", "ORCA transport が利用できません。");
        }
        try {
            OrcaTransportResult response = orcaTransport.invokeDetailed(
                    OrcaEndpoint.MANAGE_USERS,
                    OrcaTransportRequest.post(requestXml));
            return parseManageUsersResult(response);
        } catch (RuntimeException ex) {
            if (ex instanceof OrcaGatewayException) {
                throw restError(request, Response.Status.BAD_GATEWAY,
                        "orca_gateway_error", ex.getMessage() != null ? ex.getMessage() : "ORCA 呼び出しに失敗しました。");
            }
            throw ex;
        }
    }

    private ManageUsersResult parseManageUsersResult(OrcaTransportResult response) {
        int status = response != null ? response.getStatus() : 0;
        String body = response != null ? response.getBody() : null;
        String apiResult = extractFirst(API_RESULT_PATTERN, body);
        String apiMessage = extractFirst(API_MESSAGE_PATTERN, body);
        List<OrcaUserSnapshot> users = parseUsers(body);
        return new ManageUsersResult(status, apiResult, apiMessage, users);
    }

    private void ensureManageUsersSuccess(HttpServletRequest request, ManageUsersResult result) {
        if (result == null) {
            throw restError(request, Response.Status.BAD_GATEWAY, "orca_empty_response", "ORCA から応答を取得できませんでした。");
        }
        if (result.httpStatus() < 200 || result.httpStatus() >= 300) {
            throw restError(request, Response.Status.BAD_GATEWAY,
                    "orca_http_error", "ORCA manageusersv2 が HTTP " + result.httpStatus() + " を返しました。",
                    Map.of("orcaHttpStatus", result.httpStatus()), null);
        }
        if (!OrcaApiProxySupport.isApiResultSuccess(result.apiResult())) {
            String message = result.apiResultMessage() != null ? result.apiResultMessage() : "ORCA manageusersv2 でエラーが発生しました。";
            Response.Status status = looksConflict(message) ? Response.Status.CONFLICT : Response.Status.BAD_REQUEST;
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("apiResult", result.apiResult());
            details.put("apiResultMessage", message);
            details.put("validationError", Boolean.TRUE);
            throw restError(request, status, "orca_api_error", message, details, null);
        }
    }

    private List<OrcaUserSnapshot> parseUsers(String xml) {
        if (xml == null || xml.isBlank()) {
            return List.of();
        }
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(false);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document document = builder.parse(new InputSource(new StringReader(xml)));

            List<OrcaUserSnapshot> parsed = new ArrayList<>();
            NodeList nodes = document.getElementsByTagName("User_Information_child");
            for (int i = 0; i < nodes.getLength(); i++) {
                if (nodes.item(i) instanceof Element element) {
                    OrcaUserSnapshot user = parseUserElement(element);
                    if (user != null) {
                        parsed.add(user);
                    }
                }
            }
            if (!parsed.isEmpty()) {
                return parsed;
            }

            NodeList singleNode = document.getElementsByTagName("User_Information");
            for (int i = 0; i < singleNode.getLength(); i++) {
                if (singleNode.item(i) instanceof Element element) {
                    OrcaUserSnapshot user = parseUserElement(element);
                    if (user != null) {
                        parsed.add(user);
                    }
                }
            }
            return parsed;
        } catch (Exception ex) {
            LOGGER.log(Level.FINE, "Failed to parse manageusersv2 response", ex);
            return List.of();
        }
    }

    private OrcaUserSnapshot parseUserElement(Element element) {
        if (element == null) {
            return null;
        }
        String userId = firstNonBlank(
                textOf(element, "New_User_Id"),
                textOf(element, "User_Id"));
        if (userId == null) {
            return null;
        }
        String fullName = firstNonBlank(textOf(element, "New_Full_Name"), textOf(element, "Full_Name"));
        String kana = firstNonBlank(textOf(element, "New_Kana_Name"), textOf(element, "Kana_Name"));
        String staffClass = firstNonBlank(textOf(element, "New_Group_Number"), textOf(element, "Group_Number"));
        String staffNumber = firstNonBlank(textOf(element, "New_User_Number"), textOf(element, "User_Number"));
        String admin = firstNonBlank(textOf(element, "New_Administrator_Privilege"), textOf(element, "Administrator_Privilege"));
        return new OrcaUserSnapshot(
                normalizeToken(userId),
                normalizeToken(fullName),
                normalizeToken(kana),
                normalizeToken(staffClass),
                normalizeToken(staffNumber),
                "1".equals(normalizeToken(admin)));
    }

    private String textOf(Element parent, String tagName) {
        NodeList list = parent.getElementsByTagName(tagName);
        if (list == null || list.getLength() == 0 || list.item(0) == null) {
            return null;
        }
        String text = list.item(0).getTextContent();
        return normalizeToken(text);
    }

    private Map<String, Map<String, Object>> loadLinkByOrcaUser(String facilityId) {
        if (em == null || facilityId == null || facilityId.isBlank() || !isLinkTablePresent()) {
            return Map.of();
        }
        Map<String, OrcaUserLinkQueryService.OrcaFacilityLinkRow> rows =
                orcaUserLinks().findLinksByFacilityPrefix(facilityId + IInfoModel.COMPOSITE_KEY_MAKER + "%");
        Map<String, Map<String, Object>> map = new LinkedHashMap<>();
        for (OrcaUserLinkQueryService.OrcaFacilityLinkRow row : rows.values()) {
            if (row == null) {
                continue;
            }
            String orcaUserId = normalizeToken(row.orcaUserId());
            String ehrUserId = normalizeToken(row.ehrUserId());
            String displayName = normalizeToken(row.ehrDisplayName());
            if (orcaUserId == null || ehrUserId == null) {
                continue;
            }
            Map<String, Object> link = new LinkedHashMap<>();
            link.put("linked", Boolean.TRUE);
            link.put("ehrUserId", ehrUserId);
            link.put("ehrLoginId", extractLoginId(ehrUserId));
            link.put("ehrDisplayName", displayName);
            map.put(orcaUserId, link);
        }
        return map;
    }

    private UserModel resolveEhrUser(HttpServletRequest request, String facilityId, String ehrUserId) {
        if (em == null) {
            throw restError(request, Response.Status.SERVICE_UNAVAILABLE, "entity_manager_unavailable", "DB 接続が利用できません。");
        }
        String token = normalizeToken(ehrUserId);
        if (token == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "ehr_user_required", "電子カルテユーザーIDが必要です。");
        }
        UserModel user;
        if (token.chars().allMatch(Character::isDigit)) {
            user = em.find(UserModel.class, Long.parseLong(token));
            if (user == null) {
                throw restError(request, Response.Status.NOT_FOUND, "ehr_user_not_found", "電子カルテユーザーが見つかりません。");
            }
        } else {
            String composite = token.contains(IInfoModel.COMPOSITE_KEY_MAKER)
                    ? token
                    : facilityId + IInfoModel.COMPOSITE_KEY_MAKER + token;
            List<UserModel> list = em.createQuery("from UserModel u where u.userId=:uid", UserModel.class)
                    .setParameter("uid", composite)
                    .setMaxResults(1)
                    .getResultList();
            if (list.isEmpty()) {
                throw restError(request, Response.Status.NOT_FOUND, "ehr_user_not_found", "電子カルテユーザーが見つかりません。");
            }
            user = list.get(0);
        }
        String userId = user.getUserId();
        String facilityPrefix = facilityId + IInfoModel.COMPOSITE_KEY_MAKER;
        if (userId == null || !userId.startsWith(facilityPrefix)) {
            throw restError(request, Response.Status.FORBIDDEN, "facility_mismatch", "他施設のユーザーは操作できません。");
        }
        return user;
    }

    private void requireLinkTableAvailable(HttpServletRequest request) {
        if (!isLinkTablePresent()) {
            throw restError(request, Response.Status.SERVICE_UNAVAILABLE,
                    "orca_link_table_missing",
                    "ORCAユーザー連携テーブルが存在しません。Flyway migration を適用してください。");
        }
    }

    private boolean isLinkTablePresent() {
        if (em == null) {
            return false;
        }
        return orcaUserLinks().isLinkTablePresent();
    }

    private Long findOwnerByOrcaUserId(String orcaUserId) {
        if (em == null || !isLinkTablePresent()) {
            return null;
        }
        return orcaUserLinks().findOwnerByOrcaUserId(orcaUserId);
    }

    private OrcaUserLinkQueryService orcaUserLinks() {
        return new OrcaUserLinkQueryService(em);
    }

    private Map<String, Object> toUserPayload(OrcaUserSnapshot user, Map<String, Object> link) {
        Map<String, Object> map = new LinkedHashMap<>();
        if (user != null) {
            map.put("userId", user.userId());
            map.put("fullName", user.fullName());
            map.put("fullNameKana", user.fullNameKana());
            map.put("staffClass", user.staffClass());
            map.put("staffNumber", user.staffNumber());
            map.put("isAdmin", user.isAdmin());
        }
        if (link != null && !link.isEmpty()) {
            map.put("link", link);
        } else {
            map.put("link", Map.of("linked", Boolean.FALSE));
        }
        return map;
    }

    private Map<String, Object> baseEnvelope(String runId,
                                             HttpServletRequest request,
                                             String apiResult,
                                             String apiResultMessage,
                                             boolean ok) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", ok);
        body.put("runId", runId);
        if (apiResult != null) {
            body.put("apiResult", apiResult);
        }
        if (apiResultMessage != null) {
            body.put("apiResultMessage", apiResultMessage);
        }
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            body.put("traceId", traceId);
        }
        return body;
    }

    private Map<String, Object> toSyncStatusPayload(SyncState state) {
        SyncState normalized = state != null ? state : SyncState.idle();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("running", normalized.running());
        map.put("lastSyncedAt", normalized.lastSyncedAt());
        map.put("syncedCount", normalized.syncedCount());
        map.put("recentErrorSummary", normalized.recentErrorSummary());
        return map;
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

    private OrcaUserSnapshot findUser(List<OrcaUserSnapshot> users, String userId) {
        if (users == null || users.isEmpty()) {
            return null;
        }
        String normalized = normalizeToken(userId);
        if (normalized == null) {
            return null;
        }
        for (OrcaUserSnapshot user : users) {
            if (user != null && normalized.equals(normalizeToken(user.userId()))) {
                return user;
            }
        }
        return null;
    }

    private boolean looksConflict(String message) {
        if (message == null) {
            return false;
        }
        String normalized = message.toLowerCase(Locale.ROOT);
        return normalized.contains("already")
                || normalized.contains("duplicate")
                || message.contains("既")
                || message.contains("重複");
    }

    private String summarizeError(Throwable throwable) {
        if (throwable == null) {
            return "unknown error";
        }
        String message = throwable.getMessage();
        if (message == null || message.isBlank()) {
            return throwable.getClass().getSimpleName();
        }
        return message.length() > 200 ? message.substring(0, 200) : message;
    }

    private String requiredOrcaUserId(HttpServletRequest request, Map<String, Object> payload, String... keys) {
        String userId = requiredToken(request, payload, keys);
        if (!USER_ID_PATTERN.matcher(userId).matches()) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_user_id",
                    "ORCA User_Id は半角英数字とアンダースコアのみ使用できます。");
        }
        return userId;
    }

    private String requiredToken(HttpServletRequest request, Map<String, Object> payload, String... keys) {
        String value = optionalToken(payload, keys);
        if (value == null) {
            String name = (keys != null && keys.length > 0) ? keys[0] : "field";
            throw restError(request, Response.Status.BAD_REQUEST, "required_field_missing", name + " は必須です。");
        }
        return value;
    }

    private String optionalToken(Map<String, Object> payload, String... keys) {
        if (payload == null || keys == null) {
            return null;
        }
        for (String key : keys) {
            if (key == null) {
                continue;
            }
            Object value = payload.get(key);
            String token = normalizeToken(asString(value));
            if (token != null) {
                return token;
            }
        }
        return null;
    }

    private Boolean optionalBoolean(Map<String, Object> payload, String... keys) {
        if (payload == null || keys == null) {
            return null;
        }
        for (String key : keys) {
            if (key == null) {
                continue;
            }
            if (!payload.containsKey(key)) {
                continue;
            }
            Object value = payload.get(key);
            if (value instanceof Boolean bool) {
                return bool;
            }
            if (value instanceof Number number) {
                return number.intValue() != 0;
            }
            if (value instanceof String text) {
                String normalized = text.trim().toLowerCase(Locale.ROOT);
                if (normalized.isEmpty()) {
                    continue;
                }
                if ("1".equals(normalized) || "true".equals(normalized) || "yes".equals(normalized) || "on".equals(normalized)) {
                    return Boolean.TRUE;
                }
                if ("0".equals(normalized) || "false".equals(normalized) || "no".equals(normalized) || "off".equals(normalized)) {
                    return Boolean.FALSE;
                }
            }
        }
        return null;
    }

    private String asString(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String text) {
            return text;
        }
        if (value instanceof Number || value instanceof Boolean) {
            return String.valueOf(value);
        }
        return null;
    }

    private String normalizeToken(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            String token = normalizeToken(value);
            if (token != null) {
                return token;
            }
        }
        return null;
    }

    private String extractLoginId(String compositeUserId) {
        String value = normalizeToken(compositeUserId);
        if (value == null) {
            return null;
        }
        int index = value.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (index >= 0 && index + 1 < value.length()) {
            return value.substring(index + 1);
        }
        return value;
    }

    private static String extractFirst(Pattern pattern, String text) {
        if (pattern == null || text == null) {
            return null;
        }
        Matcher matcher = pattern.matcher(text);
        if (!matcher.find()) {
            return null;
        }
        String group = matcher.group(1);
        if (group == null) {
            return null;
        }
        String normalized = group.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String buildCreateRequestXml(String userId,
                                         String password,
                                         String staffClass,
                                         String fullName,
                                         String fullNameKana,
                                         String staffNumber,
                                         Boolean isAdmin) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data>");
        builder.append("<manageusersreq type=\"record\">");
        builder.append("<Request_Number type=\"string\">02</Request_Number>");
        builder.append("<User_Information type=\"record\">");
        xmlElement(builder, "User_Id", userId);
        xmlElement(builder, "User_Password", password);
        xmlElement(builder, "Group_Number", staffClass);
        xmlElement(builder, "Full_Name", fullName);
        xmlElement(builder, "Kana_Name", fullNameKana);
        xmlElement(builder, "User_Number", staffNumber);
        xmlElement(builder, "Administrator_Privilege", Boolean.TRUE.equals(isAdmin) ? "1" : "0");
        builder.append("</User_Information>");
        builder.append("</manageusersreq>");
        builder.append("</data>");
        return builder.toString();
    }

    private String buildUpdateRequestXml(String currentUserId,
                                         String newUserId,
                                         String newPassword,
                                         String newStaffClass,
                                         String newFullName,
                                         String newFullNameKana,
                                         String newStaffNumber,
                                         Boolean newIsAdmin) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data>");
        builder.append("<manageusersreq type=\"record\">");
        builder.append("<Request_Number type=\"string\">03</Request_Number>");
        builder.append("<User_Information type=\"record\">");
        xmlElement(builder, "User_Id", currentUserId);
        xmlElement(builder, "New_User_Id", newUserId);
        xmlElement(builder, "New_User_Password", newPassword);
        xmlElement(builder, "New_Group_Number", newStaffClass);
        xmlElement(builder, "New_Full_Name", newFullName);
        xmlElement(builder, "New_Kana_Name", newFullNameKana);
        xmlElement(builder, "New_User_Number", newStaffNumber);
        if (newIsAdmin != null) {
            xmlElement(builder, "New_Administrator_Privilege", Boolean.TRUE.equals(newIsAdmin) ? "1" : "0");
        }
        builder.append("</User_Information>");
        builder.append("</manageusersreq>");
        builder.append("</data>");
        return builder.toString();
    }

    private String buildDeleteRequestXml(String userId) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data>");
        builder.append("<manageusersreq type=\"record\">");
        builder.append("<Request_Number type=\"string\">04</Request_Number>");
        builder.append("<User_Information type=\"record\">");
        xmlElement(builder, "User_Id", userId);
        builder.append("</User_Information>");
        builder.append("</manageusersreq>");
        builder.append("</data>");
        return builder.toString();
    }

    private void xmlElement(StringBuilder builder, String name, String value) {
        if (builder == null || name == null || value == null) {
            return;
        }
        builder.append('<').append(name).append(" type=\"string\">");
        builder.append(escapeXml(value));
        builder.append("</").append(name).append('>');
    }

    private String escapeXml(String value) {
        StringBuilder builder = new StringBuilder(value.length() + 16);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '&' -> builder.append("&amp;");
                case '<' -> builder.append("&lt;");
                case '>' -> builder.append("&gt;");
                case '"' -> builder.append("&quot;");
                case '\'' -> builder.append("&apos;");
                default -> builder.append(c);
            }
        }
        return builder.toString();
    }

    private record OrcaUserSnapshot(
            String userId,
            String fullName,
            String fullNameKana,
            String staffClass,
            String staffNumber,
            boolean isAdmin
    ) {
    }

    private record ManageUsersResult(
            int httpStatus,
            String apiResult,
            String apiResultMessage,
            List<OrcaUserSnapshot> users
    ) {
    }

    private record SyncState(
            boolean running,
            String lastSyncedAt,
            Integer syncedCount,
            String recentErrorSummary
    ) {
        static SyncState idle() {
            return new SyncState(false, null, null, null);
        }

        SyncState withRunning(boolean value) {
            return new SyncState(value, lastSyncedAt, syncedCount, recentErrorSummary);
        }
    }
}

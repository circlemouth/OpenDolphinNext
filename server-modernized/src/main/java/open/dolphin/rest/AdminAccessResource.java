package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.logging.Logger;
import java.util.regex.Pattern;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.RoleModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.persistence.query.OrcaUserLinkQueryService;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.security.auth.PasswordHashService;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;

/**
 * Web client Administration 向けの職員ユーザー管理 API。
 *
 * <p>パスワードリセットは管理者の Authenticator（TOTP）を必須とする。</p>
 */
@Path("/admin/access")
public class AdminAccessResource extends AbstractResource {

    private static final Logger LOGGER = Logger.getLogger(AdminAccessResource.class.getName());

    private static final Set<String> ALLOWED_SEX = Set.of("M", "F", "O");
    private static final Pattern ORCA_USER_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_]+$");
    private static final Pattern UPPERCASE_PATTERN = Pattern.compile(".*[A-Z].*");
    private static final Pattern LOWERCASE_PATTERN = Pattern.compile(".*[a-z].*");
    private static final Pattern DIGIT_PATTERN = Pattern.compile(".*\\d.*");
    private static final Pattern SYMBOL_PATTERN = Pattern.compile(".*[^A-Za-z0-9].*");
    private static final String BASELINE_ROLE = "user";

    @PersistenceContext
    private EntityManager em;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private TotpVerificationSupport totpVerificationSupport;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    private PasswordHashService passwordHashService;

    @GET
    @Path("/users")
    @Produces(MediaType.APPLICATION_JSON)
    public Response listUsers(@jakarta.ws.rs.core.Context HttpServletRequest request) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        String facilityId = getRemoteFacility(actor);

        List<UserModel> users = userServiceBean.getAllUser(facilityId);
        List<Long> userPks = users.stream().mapToLong(UserModel::getId).boxed().toList();
        Map<Long, UserAccessProfileRow> profileMap = loadProfiles(userPks);
        Map<Long, OrcaLinkStatus> orcaLinkMap = loadOrcaLinks(userPks);

        List<Map<String, Object>> rows = users.stream()
                .sorted(Comparator.comparing((UserModel u) -> extractLoginId(u.getUserId()),
                        Comparator.nullsLast(String::compareToIgnoreCase)))
                .map((user) -> toUserRow(user, profileMap.get(user.getId()), orcaLinkMap.get(user.getId())))
                .toList();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("facilityId", facilityId);
        body.put("users", rows);

        recordAudit(request, "ADMIN_ACCESS_USERS_LIST", AuditEventEnvelope.Outcome.SUCCESS, runId,
                Map.of("operation", "list", "facilityId", facilityId, "usersReturned", rows.size()),
                null, null);

        return Response.ok(body).header("x-run-id", runId).build();
    }

    @POST
    @Path("/users")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Transactional
    public Response createUser(@jakarta.ws.rs.core.Context HttpServletRequest request, Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        String facilityId = getRemoteFacility(actor);

        if (payload == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "payload_required", "payload が必要です。");
        }

        String loginId = trimToNull(asString(payload.get("loginId")));
        if (loginId == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "loginId_required", "loginId は必須です。");
        }
        if (loginId.contains(IInfoModel.COMPOSITE_KEY_MAKER) || loginId.contains(" ")) {
            throw restError(request, Response.Status.BAD_REQUEST, "loginId_invalid", "loginId に ':' や空白は使用できません。");
        }

        String password = trimToNull(asString(payload.get("password")));
        if (password == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "password_required", "password は必須です。");
        }
        if (password.length() < 8) {
            throw restError(request, Response.Status.BAD_REQUEST, "password_too_short", "password は 8 文字以上にしてください。");
        }

        String displayName = trimToNull(asString(payload.get("displayName")));
        if (displayName == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "displayName_required", "氏名（displayName）は必須です。");
        }

        String sex = trimToNullableToken(asString(payload.get("sex")));
        if (sex != null && !ALLOWED_SEX.contains(sex)) {
            throw restError(request, Response.Status.BAD_REQUEST, "sex_invalid", "性別は M/F/O のいずれかです。", Map.of("sex", sex), null);
        }
        String staffRole = trimToNull(asString(payload.get("staffRole")));

        String sirName = trimToNull(asString(payload.get("sirName")));
        String givenName = trimToNull(asString(payload.get("givenName")));
        String email = trimToEmpty(asString(payload.get("email")));

        List<String> roles = normalizeRoles(payload.get("roles"));
        if (!containsRole(roles, BASELINE_ROLE)) {
            roles.add(BASELINE_ROLE);
        }
        String orcaUserId = trimToNull(asString(payload.get("orcaUserId")));
        if (orcaUserId != null && !ORCA_USER_ID_PATTERN.matcher(orcaUserId).matches()) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_orca_user_id",
                    "ORCA User_Id は半角英数字とアンダースコアのみ使用できます。");
        }
        if (hasPrivilegedRoles(roles) && orcaUserId == null) {
            throw restError(request, Response.Status.CONFLICT, "orca_link_required",
                    "電子カルテ側の権限付与は ORCA 連携済みユーザーのみ実行できます。ORCA User_Id を指定してください。");
        }

        String compositeUserId = facilityId + IInfoModel.COMPOSITE_KEY_MAKER + loginId;
        if (userExists(compositeUserId)) {
            throw restError(request, Response.Status.CONFLICT, "user_exists", "既に存在する loginId です。");
        }

        UserModel user = new UserModel();
        user.setUserId(compositeUserId);
        user.setPassword(passwordHashService.hashForStorage(password));
        user.setCommonName(displayName);
        user.setSirName(sirName);
        user.setGivenName(givenName);
        user.setEmail(email);
        user.setMemberType("PROCESS");
        user.setRegisteredDate(new java.util.Date());
        user.setFacilityModel(resolveFacility(facilityId));
        em.persist(user);
        em.flush();

        persistRoles(user, roles);
        UserAccessProfileRow profile = upsertProfile(user.getId(), sex, staffRole, null, Instant.now());
        OrcaLinkStatus orcaLink = null;
        if (orcaUserId != null) {
            orcaLink = upsertOrcaLink(request, user.getId(), orcaUserId, actor);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("user", toUserRow(user, profile, orcaLink));

        Map<String, Object> auditDetails = new LinkedHashMap<>();
        auditDetails.put("operation", "create");
        auditDetails.put("facilityId", facilityId);
        auditDetails.put("targetUserPk", user.getId());
        auditDetails.put("targetLoginId", loginId);
        auditDetails.put("roles", roles);
        auditDetails.put("sex", sex);
        auditDetails.put("staffRole", staffRole);
        auditDetails.put("orcaUserId", orcaUserId);
        recordAudit(request, "ADMIN_ACCESS_USER_CREATE", AuditEventEnvelope.Outcome.SUCCESS, runId, auditDetails, null, null);

        return Response.status(Response.Status.CREATED).entity(body).header("x-run-id", runId).build();
    }

    @PUT
    @Path("/users/{userPk}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Transactional
    public Response updateUser(@jakarta.ws.rs.core.Context HttpServletRequest request,
                               @PathParam("userPk") long userPk,
                               Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        String facilityId = getRemoteFacility(actor);

        if (payload == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "payload_required", "payload が必要です。");
        }

        UserModel user = em.find(UserModel.class, userPk);
        if (user == null) {
            throw restError(request, Response.Status.NOT_FOUND, "user_not_found", "ユーザーが見つかりません。");
        }
        requireSameFacility(request, facilityId, user.getUserId());

        String displayName = trimToNull(asString(payload.get("displayName")));
        String sirName = trimToNull(asString(payload.get("sirName")));
        String givenName = trimToNull(asString(payload.get("givenName")));
        String email = asString(payload.get("email")) != null ? trimToEmpty(asString(payload.get("email"))) : null;

        if (displayName != null) user.setCommonName(displayName);
        if (sirName != null) user.setSirName(sirName);
        if (givenName != null) user.setGivenName(givenName);
        if (email != null) user.setEmail(email);

        String sexToken = trimToNullableToken(asString(payload.get("sex")));
        if (sexToken != null && !ALLOWED_SEX.contains(sexToken) && !sexToken.isBlank()) {
            throw restError(request, Response.Status.BAD_REQUEST, "sex_invalid", "性別は M/F/O のいずれかです。", Map.of("sex", sexToken), null);
        }
        String staffRole = asString(payload.get("staffRole")) != null ? trimToNull(asString(payload.get("staffRole"))) : null;

        boolean rolesProvided = payload.containsKey("roles");
        List<String> roles = rolesProvided ? normalizeRoles(payload.get("roles")) : List.of();
        String orcaUserId = trimToNull(asString(payload.get("orcaUserId")));
        if (orcaUserId != null && !ORCA_USER_ID_PATTERN.matcher(orcaUserId).matches()) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_orca_user_id",
                    "ORCA User_Id は半角英数字とアンダースコアのみ使用できます。");
        }
        OrcaLinkStatus orcaLink = null;
        if (orcaUserId != null) {
            orcaLink = upsertOrcaLink(request, userPk, orcaUserId, actor);
        }
        if (rolesProvided) {
            if (!containsRole(roles, BASELINE_ROLE)) {
                roles.add(BASELINE_ROLE);
            }
            if (hasPrivilegedRoles(roles)) {
                OrcaLinkStatus effectiveLink = orcaLink != null ? orcaLink : findOrcaLinkByUserPk(userPk);
                if (effectiveLink == null) {
                    throw restError(request, Response.Status.CONFLICT, "orca_link_required",
                            "電子カルテ側の権限付与は ORCA 連携済みユーザーのみ実行できます。");
                }
                orcaLink = effectiveLink;
            }
            long actorPk = resolveActorUserPk(actor);
            if (actorPk == userPk && !containsAdminRole(roles)) {
                throw restError(request, Response.Status.BAD_REQUEST, "cannot_remove_own_admin_role",
                        "自分自身の admin 権限は削除できません。別の管理者で実行してください。");
            }
            replaceRoles(user, roles);
        }

        Instant now = Instant.now();
        UserAccessProfileRow profile = upsertProfile(userPk, sexToken, staffRole, null, now);
        if (orcaLink == null) {
            orcaLink = findOrcaLinkByUserPk(userPk);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("user", toUserRow(user, profile, orcaLink));

        Map<String, Object> updateAuditDetails = new LinkedHashMap<>();
        updateAuditDetails.put("operation", "update");
        updateAuditDetails.put("facilityId", facilityId);
        updateAuditDetails.put("targetUserPk", userPk);
        updateAuditDetails.put("targetLoginId", extractLoginId(user.getUserId()));
        updateAuditDetails.put("roles", rolesProvided ? roles : null);
        updateAuditDetails.put("sex", sexToken);
        updateAuditDetails.put("staffRole", staffRole);
        updateAuditDetails.put("orcaUserId", orcaLink != null ? orcaLink.orcaUserId() : null);
        recordAudit(request, "ADMIN_ACCESS_USER_UPDATE", AuditEventEnvelope.Outcome.SUCCESS, runId, updateAuditDetails, null, null);

        return Response.ok(body).header("x-run-id", runId).build();
    }

    public Response resetPassword(@jakarta.ws.rs.core.Context HttpServletRequest request,
                                  @PathParam("userPk") long userPk,
                                  Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = requireAdminActor(request, runId);
        String facilityId = getRemoteFacility(actor);

        UserModel target = em.find(UserModel.class, userPk);
        if (target == null) {
            throw restError(request, Response.Status.NOT_FOUND, "user_not_found", "ユーザーが見つかりません。");
        }
        requireSameFacility(request, facilityId, target.getUserId());

        String totpCode = payload != null ? trimToNull(asString(payload.get("totpCode"))) : null;
        long actorPk = resolveActorUserPk(actor);
        verifyAdminTotp(request, actorPk, totpCode);

        if (payload == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "payload_required", "payload が必要です。");
        }
        String tempPassword = trimToNull(asString(payload.get("temporaryPassword")));
        if (tempPassword == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "temporary_password_required",
                    "temporaryPassword は必須です。");
        }
        validateTemporaryPassword(request, tempPassword);

        target.setPassword(passwordHashService.hashForStorage(tempPassword));
        em.merge(target);
        upsertProfile(userPk, null, null, Boolean.TRUE, Instant.now());
        boolean sessionInvalidated = invalidateCurrentSession(request);

        Map<String, Object> resetAuditDetails = new LinkedHashMap<>();
        resetAuditDetails.put("operation", "password-reset");
        resetAuditDetails.put("facilityId", facilityId);
        resetAuditDetails.put("targetUserPk", userPk);
        resetAuditDetails.put("targetLoginId", extractLoginId(target.getUserId()));
        resetAuditDetails.put("mustChangePassword", Boolean.TRUE);
        resetAuditDetails.put("sessionInvalidated", sessionInvalidated);
        recordAudit(request, "ADMIN_ACCESS_PASSWORD_RESET", AuditEventEnvelope.Outcome.SUCCESS, runId, resetAuditDetails, null, null);

        return Response.noContent()
                .header("x-run-id", runId)
                .header("Cache-Control", "no-store")
                .header("Pragma", "no-cache")
                .build();
    }

    private String requireAdminActor(HttpServletRequest request, String runId) {
        try {
            return AdminResourceSupport.requireAdminActor(this, request, userServiceBean);
        } catch (WebApplicationException ex) {
            int status = ex.getResponse() != null ? ex.getResponse().getStatus() : 500;
            String reason = status == 401 ? "unauthorized" : "forbidden";
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("operation", "access");
            details.put("status", status);
            details.put("reason", reason);
            if (request != null && request.getRemoteUser() != null) {
                details.put("actor", request.getRemoteUser());
            }
            recordAudit(request, "ADMIN_ACCESS_DENIED", AuditEventEnvelope.Outcome.FAILURE, runId,
                    details, reason, status == 401 ? "Authentication required" : "Admin role required");
            throw ex;
        }
    }

    private boolean userExists(String userId) {
        List<Long> list = em.createQuery("select u.id from UserModel u where u.userId=:uid", Long.class)
                .setParameter("uid", userId)
                .setMaxResults(1)
                .getResultList();
        return !list.isEmpty();
    }

    protected long resolveActorUserPk(String actorUserId) {
        UserModel actor = em.createQuery("from UserModel u where u.userId=:uid", UserModel.class)
                .setParameter("uid", actorUserId)
                .getSingleResult();
        return actor.getId();
    }

    private void requireSameFacility(HttpServletRequest request, String facilityId, String targetUserId) {
        if (facilityId == null || facilityId.isBlank() || targetUserId == null) {
            throw restError(request, Response.Status.FORBIDDEN, "forbidden", "対象ユーザーの施設境界が不明です。");
        }
        if (!targetUserId.startsWith(facilityId + IInfoModel.COMPOSITE_KEY_MAKER)) {
            throw restError(request, Response.Status.FORBIDDEN, "facility_mismatch", "他施設のユーザーは操作できません。");
        }
    }

    private Map<Long, UserAccessProfileRow> loadProfiles(List<Long> userPks) {
        if (userPks == null || userPks.isEmpty() || !isUserAccessProfileTablePresent()) {
            return Map.of();
        }
        List<?> rows = em.createNativeQuery(
                        "select user_pk, sex, staff_role, must_change_password, created_at, updated_at "
                                + "from opendolphin.d_user_access_profile where user_pk in :ids")
                .setParameter("ids", userPks)
                .getResultList();
        Map<Long, UserAccessProfileRow> map = new HashMap<>();
        for (Object rowObj : rows) {
            if (!(rowObj instanceof Object[] row) || row.length < 6) {
                continue;
            }
            Long userPk = asLong(row[0]);
            if (userPk != null) {
                map.put(userPk, new UserAccessProfileRow(
                        userPk,
                        trimToNull(asString(row[1])),
                        trimToNull(asString(row[2])),
                        asBoolean(row[3]),
                        asInstant(row[4]),
                        asInstant(row[5])));
            }
        }
        return map;
    }

    private Map<Long, OrcaLinkStatus> loadOrcaLinks(List<Long> userPks) {
        if (userPks == null || userPks.isEmpty() || !isOrcaLinkTablePresent()) {
            return Map.of();
        }
        Map<Long, OrcaUserLinkQueryService.OrcaLinkRow> rows = orcaUserLinks().findLinksByUserPks(userPks);
        Map<Long, OrcaLinkStatus> map = new HashMap<>();
        for (OrcaUserLinkQueryService.OrcaLinkRow row : rows.values()) {
            if (row == null) {
                continue;
            }
            map.put(row.ehrUserPk(), new OrcaLinkStatus(row.orcaUserId(), toIsoTimestamp(row.updatedAt())));
        }
        return map;
    }

    private OrcaLinkStatus findOrcaLinkByUserPk(long userPk) {
        if (!isOrcaLinkTablePresent()) {
            return null;
        }
        OrcaUserLinkQueryService.OrcaLinkRow row = orcaUserLinks().findLinkByUserPk(userPk);
        if (row == null) {
            return null;
        }
        return new OrcaLinkStatus(row.orcaUserId(), toIsoTimestamp(row.updatedAt()));
    }

    private Map<String, Object> toUserRow(UserModel user, UserAccessProfileRow profile, OrcaLinkStatus orcaLink) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("userPk", user.getId());
        row.put("userId", user.getUserId());
        row.put("loginId", extractLoginId(user.getUserId()));
        row.put("displayName", user.getCommonName());
        row.put("sirName", user.getSirName());
        row.put("givenName", user.getGivenName());
        row.put("email", user.getEmail());
        row.put("roles", user.getRoles() == null ? List.of() : user.getRoles().stream()
                .map(RoleModel::getRole)
                .filter(Objects::nonNull)
                .toList());
        row.put("factor2Auth", user.getFactor2Auth());
        row.put("registeredDate", user.getRegisteredDateAsString());
        if (profile != null) {
            row.put("sex", profile.sex());
            row.put("staffRole", profile.staffRole());
            row.put("mustChangePassword", profile.mustChangePassword());
            row.put("profileCreatedAt", profile.createdAt() != null ? profile.createdAt().toString() : null);
            row.put("profileUpdatedAt", profile.updatedAt() != null ? profile.updatedAt().toString() : null);
        } else {
            row.put("sex", null);
            row.put("staffRole", null);
            row.put("mustChangePassword", Boolean.FALSE);
            row.put("profileCreatedAt", null);
            row.put("profileUpdatedAt", null);
        }
        if (orcaLink != null) {
            Map<String, Object> link = new LinkedHashMap<>();
            link.put("linked", Boolean.TRUE);
            link.put("orcaUserId", orcaLink.orcaUserId());
            link.put("updatedAt", orcaLink.updatedAt());
            row.put("orcaLink", link);
        } else {
            row.put("orcaLink", Map.of("linked", Boolean.FALSE));
        }
        return row;
    }

    private void persistRoles(UserModel user, List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return;
        }
        List<RoleModel> entities = new ArrayList<>();
        for (String role : roles) {
            RoleModel entity = new RoleModel();
            entity.setRole(role);
            entity.setUserModel(user);
            entity.setUserId(user.getUserId());
            em.persist(entity);
            entities.add(entity);
        }
        user.setRoles(entities);
        em.merge(user);
    }

    private void replaceRoles(UserModel user, List<String> desiredRoles) {
        List<String> normalized = desiredRoles.stream()
                .map(this::normalizeRoleToken)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        List<RoleModel> current = user.getRoles() != null ? new ArrayList<>(user.getRoles()) : new ArrayList<>();
        Set<String> currentNames = current.stream()
                .map(RoleModel::getRole)
                .filter(Objects::nonNull)
                .map((v) -> v.trim().toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());
        Set<String> desiredNames = normalized.stream()
                .map((v) -> v.trim().toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());

        for (RoleModel role : current) {
            String name = role.getRole() != null ? role.getRole().trim().toLowerCase(Locale.ROOT) : "";
            if (!desiredNames.contains(name)) {
                em.remove(em.contains(role) ? role : em.merge(role));
            }
        }

        for (String roleName : normalized) {
            if (currentNames.contains(roleName.trim().toLowerCase(Locale.ROOT))) {
                continue;
            }
            RoleModel entity = new RoleModel();
            entity.setRole(roleName);
            entity.setUserModel(user);
            entity.setUserId(user.getUserId());
            em.persist(entity);
        }

        em.flush();
        user.setRoles(em.createQuery("from RoleModel r where r.userId=:uid", RoleModel.class)
                .setParameter("uid", user.getUserId())
                .getResultList());
        em.merge(user);
    }

    protected UserAccessProfileRow upsertProfile(long userPk, String sex, String staffRole, Boolean mustChangePassword, Instant now) {
        if (!isUserAccessProfileTablePresent()) {
            return null;
        }
        UserAccessProfileRow existing = findProfileByUserPk(userPk);
        String effectiveSex = sex != null ? (sex.isBlank() ? null : sex)
                : (existing != null ? existing.sex() : null);
        String effectiveStaffRole = staffRole != null ? (staffRole.isBlank() ? null : staffRole)
                : (existing != null ? existing.staffRole() : null);
        boolean effectiveMustChange = mustChangePassword != null
                ? mustChangePassword
                : (existing != null && existing.mustChangePassword());
        Instant createdAt = existing != null && existing.createdAt() != null ? existing.createdAt() : now;

        em.createNativeQuery(
                        "insert into opendolphin.d_user_access_profile "
                                + "(user_pk, sex, staff_role, must_change_password, created_at, updated_at) "
                                + "values (:userPk, :sex, :staffRole, :mustChangePassword, :createdAt, :updatedAt) "
                                + "on conflict (user_pk) do update set "
                                + "sex=excluded.sex, staff_role=excluded.staff_role, "
                                + "must_change_password=excluded.must_change_password, "
                                + "updated_at=excluded.updated_at")
                .setParameter("userPk", userPk)
                .setParameter("sex", effectiveSex)
                .setParameter("staffRole", effectiveStaffRole)
                .setParameter("mustChangePassword", effectiveMustChange)
                .setParameter("createdAt", Timestamp.from(createdAt))
                .setParameter("updatedAt", Timestamp.from(now))
                .executeUpdate();

        return new UserAccessProfileRow(
                userPk,
                effectiveSex,
                effectiveStaffRole,
                effectiveMustChange,
                createdAt,
                now);
    }

    private UserAccessProfileRow findProfileByUserPk(long userPk) {
        if (!isUserAccessProfileTablePresent()) {
            return null;
        }
        List<?> rows = em.createNativeQuery(
                        "select user_pk, sex, staff_role, must_change_password, created_at, updated_at "
                                + "from opendolphin.d_user_access_profile where user_pk=:userPk")
                .setParameter("userPk", userPk)
                .setMaxResults(1)
                .getResultList();
        if (rows.isEmpty()) {
            return null;
        }
        Object rowObj = rows.get(0);
        if (!(rowObj instanceof Object[] row) || row.length < 6) {
            return null;
        }
        Long foundUserPk = asLong(row[0]);
        if (foundUserPk == null) {
            return null;
        }
        return new UserAccessProfileRow(
                foundUserPk,
                trimToNull(asString(row[1])),
                trimToNull(asString(row[2])),
                asBoolean(row[3]),
                asInstant(row[4]),
                asInstant(row[5]));
    }

    protected void verifyAdminTotp(HttpServletRequest request, long actorPk, String totpCode) {
        if (totpCode == null || totpCode.isBlank()) {
            throw restError(request, Response.Status.PRECONDITION_FAILED, "totp_required",
                    "パスワードリセットには管理者の Authenticator（TOTP）コードが必要です。");
        }

        TotpVerificationSupport.VerificationResult result = totpVerificationSupport.verifyCurrentCode(actorPk, totpCode);
        if (result.status() == TotpVerificationSupport.VerificationStatus.MISSING_CREDENTIAL) {
            throw restError(request, Response.Status.PRECONDITION_FAILED, "totp_missing",
                    "Authenticator（TOTP）が未登録のためパスワードリセットできません。");
        }
        if (!result.succeeded()) {
            throw restError(request, Response.Status.FORBIDDEN, "totp_invalid", "TOTP コードが不正です。");
        }
    }

    private OrcaLinkStatus upsertOrcaLink(HttpServletRequest request, long userPk, String orcaUserId, String actor) {
        requireOrcaLinkTableAvailable(request);
        Long owner = findOwnerByOrcaUserId(orcaUserId);
        if (owner != null && owner.longValue() != userPk) {
            throw restError(request, Response.Status.CONFLICT, "orca_user_already_linked",
                    "指定した ORCA User_Id は別の電子カルテユーザーにリンク済みです。");
        }

        Instant now = Instant.now();
        orcaUserLinks().upsertLink(userPk, orcaUserId, now, actor);
        return new OrcaLinkStatus(orcaUserId, now.toString());
    }

    private void requireOrcaLinkTableAvailable(HttpServletRequest request) {
        if (isOrcaLinkTablePresent()) {
            return;
        }
        throw restError(request, Response.Status.SERVICE_UNAVAILABLE,
                "orca_link_table_missing",
                "ORCAユーザー連携テーブルが存在しません。Flyway migration を適用してください。");
    }

    private boolean isOrcaLinkTablePresent() {
        return orcaUserLinks().isLinkTablePresent();
    }

    private boolean isUserAccessProfileTablePresent() {
        List<?> rows = em.createNativeQuery(
                        "select 1 from information_schema.tables where table_schema='opendolphin' and table_name='d_user_access_profile'")
                .setMaxResults(1)
                .getResultList();
        return !rows.isEmpty();
    }

    private Long findOwnerByOrcaUserId(String orcaUserId) {
        if (!isOrcaLinkTablePresent()) {
            return null;
        }
        return orcaUserLinks().findOwnerByOrcaUserId(orcaUserId);
    }

    private OrcaUserLinkQueryService orcaUserLinks() {
        return new OrcaUserLinkQueryService(em);
    }

    private boolean containsRole(List<String> roles, String targetRole) {
        String target = normalizeRoleKey(targetRole);
        if (target == null) {
            return false;
        }
        for (String role : roles) {
            if (target.equals(normalizeRoleKey(role))) {
                return true;
            }
        }
        return false;
    }

    private boolean hasPrivilegedRoles(List<String> roles) {
        for (String role : roles) {
            String normalized = normalizeRoleKey(role);
            if (normalized == null) {
                continue;
            }
            if (!BASELINE_ROLE.equals(normalized)) {
                return true;
            }
        }
        return false;
    }

    private String normalizeRoleKey(String role) {
        if (role == null) {
            return null;
        }
        String normalized = role.trim().toLowerCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }

    private Long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String toIsoTimestamp(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant().toString();
        }
        if (value instanceof Instant instant) {
            return instant.toString();
        }
        return String.valueOf(value);
    }

    private Instant asInstant(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant();
        }
        if (value instanceof Instant instant) {
            return instant;
        }
        try {
            return Instant.parse(String.valueOf(value));
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private boolean asBoolean(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof Number number) {
            return number.intValue() != 0;
        }
        if (value instanceof String text) {
            return Boolean.parseBoolean(text);
        }
        return false;
    }

    private boolean containsAdminRole(List<String> roles) {
        for (String role : roles) {
            String normalized = normalizeRoleKey(role);
            if (normalized == null) continue;
            if (normalized.equals("admin")
                    || normalized.equals("system_admin")
                    || normalized.equals("system-admin")
                    || normalized.equals("system-administrator")
                    || normalized.equals("system_administrator")) {
                return true;
            }
        }
        return false;
    }

    private open.dolphin.infomodel.FacilityModel resolveFacility(String facilityId) {
        return em.createQuery("from FacilityModel f where f.facilityId=:fid", open.dolphin.infomodel.FacilityModel.class)
                .setParameter("fid", facilityId)
                .getSingleResult();
    }

    private List<String> normalizeRoles(Object value) {
        if (!(value instanceof List<?> list)) {
            return new ArrayList<>();
        }
        List<String> roles = new ArrayList<>();
        for (Object entry : list) {
            String token = normalizeRoleToken(entry);
            if (token != null) {
                roles.add(token);
            }
        }
        return roles;
    }

    private String normalizeRoleToken(Object value) {
        if (!(value instanceof String text)) {
            return null;
        }
        String trimmed = text.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > 64) {
            return null;
        }
        return trimmed;
    }

    private static String extractLoginId(String userId) {
        if (userId == null) return null;
        int idx = userId.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (idx < 0) return userId;
        return idx + 1 < userId.length() ? userId.substring(idx + 1) : "";
    }

    private static String asString(Object value) {
        return value instanceof String text ? text : null;
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String trimToEmpty(String value) {
        if (value == null) return "";
        return value.trim();
    }

    /**
     * For optional select values:
     * - null: not provided
     * - "": provided but empty (used as "clear")
     * - token: normalized
     */
    private static String trimToNullableToken(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed;
    }

    private void validateTemporaryPassword(HttpServletRequest request, String temporaryPassword) {
        String candidate = trimToNull(temporaryPassword);
        if (candidate == null) {
            throw restError(request, Response.Status.BAD_REQUEST, "temporary_password_required",
                    "temporaryPassword は必須です。");
        }
        if (candidate.length() < 12) {
            throw restError(request, Response.Status.BAD_REQUEST, "temporary_password_weak",
                    "temporaryPassword は 12 文字以上で指定してください。");
        }
        if (!UPPERCASE_PATTERN.matcher(candidate).matches()
                || !LOWERCASE_PATTERN.matcher(candidate).matches()
                || !DIGIT_PATTERN.matcher(candidate).matches()
                || !SYMBOL_PATTERN.matcher(candidate).matches()) {
            throw restError(request, Response.Status.BAD_REQUEST, "temporary_password_weak",
                    "temporaryPassword は英大文字・英小文字・数字・記号をすべて含めてください。");
        }
    }

    private boolean invalidateCurrentSession(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        HttpSession session = request.getSession(false);
        if (session == null) {
            return false;
        }
        try {
            session.invalidate();
            return true;
        } catch (IllegalStateException ex) {
            return false;
        }
    }

    private void recordAudit(HttpServletRequest request,
                             String action,
                             AuditEventEnvelope.Outcome outcome,
                             String runId,
                             Map<String, Object> details,
                             String errorCode,
                             String errorMessage) {
        AdminResourceSupport.recordAudit(
                this,
                sessionAuditDispatcher,
                request,
                action,
                null,
                runId,
                details,
                outcome,
                errorCode,
                errorMessage,
                "/api/admin/access");
    }

    private record OrcaLinkStatus(
            String orcaUserId,
            String updatedAt
    ) {
    }

    protected record UserAccessProfileRow(
            Long userPk,
            String sex,
            String staffRole,
            boolean mustChangePassword,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}

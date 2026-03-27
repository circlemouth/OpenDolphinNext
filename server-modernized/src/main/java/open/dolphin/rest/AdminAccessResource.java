package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
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
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
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
import open.dolphin.security.auth.AdminStepUpGuard;
import open.dolphin.security.auth.PasswordHashService;
import open.dolphin.security.auth.SessionRevocationService;
import open.dolphin.security.auth.StepUpSessionService;
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
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    private PasswordHashService passwordHashService;

    @Inject
    private AdminStepUpGuard adminStepUpGuard;

    @Inject
    private SessionRevocationService sessionRevocationService;

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
        Map<Long, OrcaLinkStatus> orcaLinkMap = loadOrcaLinks(facilityId, userPks);

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
        rejectDeprecatedTotpCode(request, payload);
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        requireAdminActor(request, runId);
        adminStepUpGuard.require(request, "admin:mutation");
        return new AdminAccessMutationSupport(
                em,
                sessionAuditDispatcher,
                passwordHashService,
                sessionRevocationService)
                .createUser(this, request, payload);
    }

    @PUT
    @Path("/users/{userPk}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Transactional
    public Response updateUser(@jakarta.ws.rs.core.Context HttpServletRequest request,
                               @PathParam("userPk") long userPk,
                               Map<String, Object> payload) {
        rejectDeprecatedTotpCode(request, payload);
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        requireAdminActor(request, runId);
        adminStepUpGuard.require(request, "admin:mutation");
        return new AdminAccessMutationSupport(
                em,
                sessionAuditDispatcher,
                passwordHashService,
                sessionRevocationService)
                .updateUser(this, request, userPk, payload);
    }

    public Response resetPassword(@jakarta.ws.rs.core.Context HttpServletRequest request,
                                  @PathParam("userPk") long userPk,
                                  Map<String, Object> payload) {
        rejectDeprecatedTotpCode(request, payload);
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        requireAdminActor(request, runId);
        adminStepUpGuard.require(request, "admin:mutation");
        return new AdminAccessMutationSupport(
                em,
                sessionAuditDispatcher,
                passwordHashService,
                sessionRevocationService)
                .resetPassword(this, request, userPk, payload);
    }

    String requireAdminActor(HttpServletRequest request, String runId) {
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

    protected long resolveActorUserPk(String actorUserId) {
        UserModel actor = em.createQuery("from UserModel u where u.userId=:uid", UserModel.class)
                .setParameter("uid", actorUserId)
                .getSingleResult();
        return actor.getId();
    }

    private void rejectDeprecatedTotpCode(HttpServletRequest request, Map<String, Object> payload) {
        if (payload != null && payload.containsKey(StepUpSessionService.DEPRECATED_OTP_FIELD)) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", "廃止された認証フィールドは受け付けません。");
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

    private Map<Long, OrcaLinkStatus> loadOrcaLinks(String facilityId, List<Long> userPks) {
        if (userPks == null || userPks.isEmpty() || !isOrcaLinkTablePresent()) {
            return Map.of();
        }
        Map<Long, OrcaUserLinkQueryService.OrcaLinkRow> rows = orcaUserLinks().findLinksByUserPks(facilityId, userPks);
        Map<Long, OrcaLinkStatus> map = new HashMap<>();
        for (OrcaUserLinkQueryService.OrcaLinkRow row : rows.values()) {
            if (row == null) {
                continue;
            }
            map.put(row.ehrUserPk(), new OrcaLinkStatus(row.orcaUserId(), toIsoTimestamp(row.updatedAt())));
        }
        return map;
    }

    private OrcaLinkStatus findOrcaLinkByUserPk(String facilityId, long userPk) {
        if (!isOrcaLinkTablePresent()) {
            return null;
        }
        OrcaUserLinkQueryService.OrcaLinkRow row = orcaUserLinks().findLinkByUserPk(facilityId, userPk);
        if (row == null) {
            return null;
        }
        return new OrcaLinkStatus(row.orcaUserId(), toIsoTimestamp(row.updatedAt()));
    }

    Map<String, Object> toUserRow(UserModel user, UserAccessProfileRow profile, OrcaLinkStatus orcaLink) {
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

    private OrcaLinkStatus upsertOrcaLink(HttpServletRequest request, long userPk, String orcaUserId, String actor) {
        requireOrcaLinkTableAvailable(request);
        String facilityId = getRemoteFacility(actor);
        Long owner = findOwnerByOrcaUserId(facilityId, orcaUserId);
        if (owner != null && owner.longValue() != userPk) {
            throw restError(request, Response.Status.CONFLICT, "orca_user_already_linked",
                    "指定した ORCA User_Id は別の電子カルテユーザーにリンク済みです。");
        }

        Instant now = Instant.now();
        orcaUserLinks().upsertLink(facilityId, userPk, orcaUserId, now, actor);
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

    private Long findOwnerByOrcaUserId(String facilityId, String orcaUserId) {
        if (!isOrcaLinkTablePresent()) {
            return null;
        }
        return orcaUserLinks().findOwnerByOrcaUserId(facilityId, orcaUserId);
    }

    private OrcaUserLinkQueryService orcaUserLinks() {
        return new OrcaUserLinkQueryService(() -> em);
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

    record OrcaLinkStatus(
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

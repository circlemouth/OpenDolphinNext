package open.dolphin.rest;

import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.FacilityModel;
import open.dolphin.infomodel.RoleModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.persistence.query.OrcaUserLinkQueryService;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.security.auth.PasswordHashService;
import open.dolphin.security.auth.SessionRevocationService;
import open.dolphin.security.auth.StepUpSessionService;
import open.dolphin.security.audit.SessionAuditDispatcher;

import static open.dolphin.rest.AdminAccessMutationSupportUtils.*;

final class AdminAccessMutationSupport {

    private static final Set<String> ALLOWED_SEX = Set.of("M", "F", "O");
    private static final Pattern ORCA_USER_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_]+$");
    private static final Pattern UPPERCASE_PATTERN = Pattern.compile(".*[A-Z].*");
    private static final Pattern LOWERCASE_PATTERN = Pattern.compile(".*[a-z].*");
    private static final Pattern DIGIT_PATTERN = Pattern.compile(".*\\d.*");
    private static final Pattern SYMBOL_PATTERN = Pattern.compile(".*[^A-Za-z0-9].*");
    private static final String BASELINE_ROLE = "user";

    private final EntityManager em;
    private final SessionAuditDispatcher sessionAuditDispatcher;
    private final PasswordHashService passwordHashService;
    private final SessionRevocationService sessionRevocationService;

    AdminAccessMutationSupport(
            EntityManager em,
            SessionAuditDispatcher sessionAuditDispatcher,
            PasswordHashService passwordHashService,
            SessionRevocationService sessionRevocationService) {
        this.em = em;
        this.sessionAuditDispatcher = sessionAuditDispatcher;
        this.passwordHashService = passwordHashService;
        this.sessionRevocationService = sessionRevocationService;
    }

    Response createUser(
            AdminAccessResource resource,
            HttpServletRequest request,
            Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = resource.requireAdminActor(request, runId);
        String facilityId = resource.getRemoteFacility(actor);
        CreateUserInput input = parseCreateUserInput(resource, request, payload);
        UserModel user = persistNewUser(input, facilityId);
        AdminAccessResource.UserAccessProfileRow profile =
                resource.upsertProfile(user.getId(), input.sex(), input.staffRole(), null, Instant.now());
        AdminAccessResource.OrcaLinkStatus orcaLink = createOrcaLink(resource, request, user.getId(), input.orcaUserId(), actor);
        Response response = buildCreateUserResponse(resource, user, profile, orcaLink, runId);
        recordCreateUserAudit(resource, request, runId, facilityId, user, input);
        return response;
    }

    Response updateUser(
            AdminAccessResource resource,
            HttpServletRequest request,
            long userPk,
            Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = resource.requireAdminActor(request, runId);
        String facilityId = resource.getRemoteFacility(actor);
        UpdateUserInput input = parseUpdateUserInput(resource, request, payload);
        UserModel user = updateExistingUser(resource, request, facilityId, userPk, input, actor);
        AdminAccessResource.OrcaLinkStatus orcaLink = null;
        boolean orcaLinkChanged = false;
        if (input.orcaUserId() != null) {
            AdminAccessResource.OrcaLinkStatus existingOrcaLink = findOrcaLinkByUserPk(facilityId, userPk);
            if (sameOrcaUserId(existingOrcaLink, input.orcaUserId())) {
                orcaLink = existingOrcaLink;
            } else {
                orcaLink = upsertOrcaLink(resource, request, userPk, input.orcaUserId(), actor);
                orcaLinkChanged = true;
            }
        }
        boolean rolesChanged = false;
        if (input.rolesProvided()) {
            rolesChanged = applyUpdatedRoles(resource, request, facilityId, user, userPk, actor, input, orcaLink);
        }
        AdminAccessResource.UserAccessProfileRow profile =
                resource.upsertProfile(userPk, input.sexToken(), input.staffRole(), null, Instant.now());
        if (orcaLink == null) {
            orcaLink = findOrcaLinkByUserPk(facilityId, userPk);
        }
        revokeChangedSecurityState(userPk, facilityId, rolesChanged, orcaLinkChanged, request);
        Response response = buildUpdateUserResponse(resource, user, profile, orcaLink, runId);
        recordUpdateUserAudit(resource, request, runId, facilityId, userPk, user, input, orcaLink);
        return response;
    }

    Response resetPassword(
            AdminAccessResource resource,
            HttpServletRequest request,
            long userPk,
            Map<String, Object> payload) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        String actor = resource.requireAdminActor(request, runId);
        String facilityId = resource.getRemoteFacility(actor);

        UserModel target = em.find(UserModel.class, userPk);
        if (target == null) {
            throw resource.restError(request, Response.Status.NOT_FOUND, "user_not_found", "ユーザーが見つかりません。");
        }
        requireSameFacility(resource, request, facilityId, target.getUserId());

        if (payload == null) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "payload_required", "payload が必要です。");
        }
        if (payload.containsKey(StepUpSessionService.DEPRECATED_OTP_FIELD)) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "invalid_request", "廃止された認証フィールドは受け付けません。");
        }
        String tempPassword = trimToNull(asString(payload.get("temporaryPassword")));
        if (tempPassword == null) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "temporary_password_required",
                    "temporaryPassword は必須です。");
        }
        validateTemporaryPassword(resource, request, tempPassword);

        target.setPassword(passwordHashService.hashForStorage(tempPassword));
        em.merge(target);
        Instant now = Instant.now();
        resource.upsertProfile(userPk, null, null, Boolean.TRUE, now);
        sessionRevocationService.incrementSessionEpoch(userPk, now);
        sessionRevocationService.incrementCredentialEpoch(userPk, now);
        sessionRevocationService.markPasswordChanged(userPk, now);
        int revokedCount = sessionRevocationService.revokeAllForUser(
                userPk,
                facilityId,
                SessionRevocationService.REASON_PASSWORD_RESET,
                request);

        Map<String, Object> resetAuditDetails = new LinkedHashMap<>();
        resetAuditDetails.put("operation", "password-reset");
        resetAuditDetails.put("facilityId", facilityId);
        resetAuditDetails.put("targetUserPk", userPk);
        resetAuditDetails.put("targetLoginId", extractLoginId(target.getUserId()));
        resetAuditDetails.put("mustChangePassword", Boolean.TRUE);
        resetAuditDetails.put("revokedCount", revokedCount);
        AdminResourceSupport.recordAudit(
                resource,
                sessionAuditDispatcher,
                request,
                "ADMIN_ACCESS_PASSWORD_RESET",
                null,
                runId,
                resetAuditDetails,
                AuditEventEnvelope.Outcome.SUCCESS,
                null,
                null,
                "/api/admin/access");

        return Response.noContent()
                .header("x-run-id", runId)
                .header("Cache-Control", "no-store")
                .header("Pragma", "no-cache")
                .build();
    }

    private CreateUserInput parseCreateUserInput(
            AdminAccessResource resource,
            HttpServletRequest request,
            Map<String, Object> payload) {
        if (payload == null) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "payload_required", "payload が必要です。");
        }
        String loginId = trimToNull(asString(payload.get("loginId")));
        if (loginId == null) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "loginId_required", "loginId は必須です。");
        }
        if (loginId.contains(IInfoModel.COMPOSITE_KEY_MAKER) || loginId.contains(" ")) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "loginId_invalid", "loginId に ':' や空白は使用できません。");
        }
        String password = trimToNull(asString(payload.get("password")));
        if (password == null) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "password_required", "password は必須です。");
        }
        if (password.length() < 8) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "password_too_short", "password は 8 文字以上にしてください。");
        }
        String displayName = trimToNull(asString(payload.get("displayName")));
        if (displayName == null) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "displayName_required", "氏名（displayName）は必須です。");
        }
        String sex = trimToNullableToken(asString(payload.get("sex")));
        if (sex != null && !ALLOWED_SEX.contains(sex)) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "sex_invalid", "性別は M/F/O のいずれかです。", Map.of("sex", sex), null);
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
            throw resource.restError(request, Response.Status.BAD_REQUEST, "invalid_orca_user_id",
                    "ORCA User_Id は半角英数字とアンダースコアのみ使用できます。");
        }
        if (hasPrivilegedRoles(roles) && orcaUserId == null) {
            throw resource.restError(request, Response.Status.CONFLICT, "orca_link_required",
                    "電子カルテ側の権限付与は ORCA 連携済みユーザーのみ実行できます。ORCA User_Id を指定してください。");
        }
        return new CreateUserInput(loginId, password, displayName, sex, staffRole, sirName, givenName, email, roles, orcaUserId);
    }

    private UserModel persistNewUser(CreateUserInput input, String facilityId) {
        String compositeUserId = facilityId + IInfoModel.COMPOSITE_KEY_MAKER + input.loginId();
        if (userExists(compositeUserId)) {
            throw new IllegalStateException("user_exists");
        }
        UserModel user = new UserModel();
        user.setUserId(compositeUserId);
        user.setPassword(passwordHashService.hashForStorage(input.password()));
        user.setCommonName(input.displayName());
        user.setSirName(input.sirName());
        user.setGivenName(input.givenName());
        user.setEmail(input.email());
        user.setMemberType("PROCESS");
        user.setRegisteredDate(new java.util.Date());
        user.setFacilityModel(resolveFacility(facilityId));
        em.persist(user);
        em.flush();
        persistRoles(user, input.roles());
        return user;
    }

    private AdminAccessResource.OrcaLinkStatus createOrcaLink(
            AdminAccessResource resource,
            HttpServletRequest request,
            long userPk,
            String orcaUserId,
            String actor) {
        return orcaUserId != null ? upsertOrcaLink(resource, request, userPk, orcaUserId, actor) : null;
    }

    private Response buildCreateUserResponse(
            AdminAccessResource resource,
            UserModel user,
            AdminAccessResource.UserAccessProfileRow profile,
            AdminAccessResource.OrcaLinkStatus orcaLink,
            String runId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("user", resource.toUserRow(user, profile, orcaLink));
        return Response.status(Response.Status.CREATED).entity(body).header("x-run-id", runId).build();
    }

    private void recordCreateUserAudit(
            AdminAccessResource resource,
            HttpServletRequest request,
            String runId,
            String facilityId,
            UserModel user,
            CreateUserInput input) {
        Map<String, Object> auditDetails = new LinkedHashMap<>();
        auditDetails.put("operation", "create");
        auditDetails.put("facilityId", facilityId);
        auditDetails.put("targetUserPk", user.getId());
        auditDetails.put("targetLoginId", input.loginId());
        auditDetails.put("roles", input.roles());
        auditDetails.put("sex", input.sex());
        auditDetails.put("staffRole", input.staffRole());
        auditDetails.put("orcaUserId", input.orcaUserId());
        AdminResourceSupport.recordAudit(
                resource,
                sessionAuditDispatcher,
                request,
                "ADMIN_ACCESS_USER_CREATE",
                null,
                runId,
                auditDetails,
                AuditEventEnvelope.Outcome.SUCCESS,
                null,
                null,
                "/api/admin/access");
    }

    private UpdateUserInput parseUpdateUserInput(
            AdminAccessResource resource,
            HttpServletRequest request,
            Map<String, Object> payload) {
        if (payload == null) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "payload_required", "payload が必要です。");
        }
        String displayName = trimToNull(asString(payload.get("displayName")));
        String sirName = trimToNull(asString(payload.get("sirName")));
        String givenName = trimToNull(asString(payload.get("givenName")));
        String email = asString(payload.get("email")) != null ? trimToEmpty(asString(payload.get("email"))) : null;
        String sexToken = trimToNullableToken(asString(payload.get("sex")));
        if (sexToken != null && !ALLOWED_SEX.contains(sexToken) && !sexToken.isBlank()) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "sex_invalid", "性別は M/F/O のいずれかです。", Map.of("sex", sexToken), null);
        }
        String staffRole = asString(payload.get("staffRole")) != null ? trimToNull(asString(payload.get("staffRole"))) : null;
        boolean rolesProvided = payload.containsKey("roles");
        List<String> roles = rolesProvided ? normalizeRoles(payload.get("roles")) : List.of();
        String orcaUserId = trimToNull(asString(payload.get("orcaUserId")));
        if (orcaUserId != null && !ORCA_USER_ID_PATTERN.matcher(orcaUserId).matches()) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "invalid_orca_user_id",
                    "ORCA User_Id は半角英数字とアンダースコアのみ使用できます。");
        }
        return new UpdateUserInput(displayName, sirName, givenName, email, sexToken, staffRole, rolesProvided, roles, orcaUserId);
    }

    private UserModel updateExistingUser(
            AdminAccessResource resource,
            HttpServletRequest request,
            String facilityId,
            long userPk,
            UpdateUserInput input,
            String actor) {
        UserModel user = em.find(UserModel.class, userPk);
        if (user == null) {
            throw resource.restError(request, Response.Status.NOT_FOUND, "user_not_found", "ユーザーが見つかりません。");
        }
        requireSameFacility(resource, request, facilityId, user.getUserId());
        if (input.displayName() != null) user.setCommonName(input.displayName());
        if (input.sirName() != null) user.setSirName(input.sirName());
        if (input.givenName() != null) user.setGivenName(input.givenName());
        if (input.email() != null) user.setEmail(input.email());
        return user;
    }

    private boolean applyUpdatedRoles(
            AdminAccessResource resource,
            HttpServletRequest request,
            String facilityId,
            UserModel user,
            long userPk,
            String actor,
            UpdateUserInput input,
            AdminAccessResource.OrcaLinkStatus orcaLink) {
        List<String> currentRoles = currentRoleNames(user);
        List<String> roles = new ArrayList<>(input.roles());
        if (!containsRole(roles, BASELINE_ROLE)) {
            roles.add(BASELINE_ROLE);
        }
        if (hasPrivilegedRoles(roles)) {
            AdminAccessResource.OrcaLinkStatus effectiveLink = orcaLink != null ? orcaLink : findOrcaLinkByUserPk(facilityId, userPk);
            if (effectiveLink == null) {
                throw resource.restError(request, Response.Status.CONFLICT, "orca_link_required",
                        "電子カルテ側の権限付与は ORCA 連携済みユーザーのみ実行できます。");
            }
        }
        long actorPk = resource.resolveActorUserPk(actor);
        if (actorPk == userPk && !containsAdminRole(roles)) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "cannot_remove_own_admin_role",
                    "自分自身の admin 権限は削除できません。別の管理者で実行してください。");
        }
        boolean changed = !sameRoleSet(currentRoles, roles);
        if (changed) {
            replaceRoles(user, roles);
        }
        return changed;
    }

    private void revokeChangedSecurityState(
            long userPk,
            String facilityId,
            boolean rolesChanged,
            boolean orcaLinkChanged,
            HttpServletRequest request) {
        if (!rolesChanged && !orcaLinkChanged) {
            return;
        }
        String reason;
        if (rolesChanged && orcaLinkChanged) {
            reason = SessionRevocationService.REASON_ACCESS_POLICY_CHANGE;
        } else if (rolesChanged) {
            reason = SessionRevocationService.REASON_PRIVILEGE_CHANGE;
        } else {
            reason = SessionRevocationService.REASON_ORCA_LINK_CHANGE;
        }
        sessionRevocationService.revokeAllForSecurityStateChange(userPk, facilityId, reason, request);
    }

    private Response buildUpdateUserResponse(
            AdminAccessResource resource,
            UserModel user,
            AdminAccessResource.UserAccessProfileRow profile,
            AdminAccessResource.OrcaLinkStatus orcaLink,
            String runId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("user", resource.toUserRow(user, profile, orcaLink));
        return Response.ok(body).header("x-run-id", runId).build();
    }

    private void recordUpdateUserAudit(
            AdminAccessResource resource,
            HttpServletRequest request,
            String runId,
            String facilityId,
            long userPk,
            UserModel user,
            UpdateUserInput input,
            AdminAccessResource.OrcaLinkStatus orcaLink) {
        Map<String, Object> updateAuditDetails = new LinkedHashMap<>();
        updateAuditDetails.put("operation", "update");
        updateAuditDetails.put("facilityId", facilityId);
        updateAuditDetails.put("targetUserPk", userPk);
        updateAuditDetails.put("targetLoginId", extractLoginId(user.getUserId()));
        updateAuditDetails.put("roles", input.rolesProvided() ? input.roles() : null);
        updateAuditDetails.put("sex", input.sexToken());
        updateAuditDetails.put("staffRole", input.staffRole());
        updateAuditDetails.put("orcaUserId", orcaLink != null ? orcaLink.orcaUserId() : null);
        AdminResourceSupport.recordAudit(
                resource,
                sessionAuditDispatcher,
                request,
                "ADMIN_ACCESS_USER_UPDATE",
                null,
                runId,
                updateAuditDetails,
                AuditEventEnvelope.Outcome.SUCCESS,
                null,
                null,
                "/api/admin/access");
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
                .map(value -> AdminAccessMutationSupportUtils.normalizeRoleToken(value))
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

    private List<String> currentRoleNames(UserModel user) {
        if (user == null || user.getRoles() == null) {
            return List.of();
        }
        return user.getRoles().stream()
                .map(RoleModel::getRole)
                .filter(Objects::nonNull)
                .toList();
    }

    private boolean sameRoleSet(List<String> currentRoles, List<String> desiredRoles) {
        Set<String> currentNames = currentRoles == null ? Set.of() : currentRoles.stream()
                .map(AdminAccessMutationSupportUtils::normalizeRoleKey)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        Set<String> desiredNames = desiredRoles == null ? Set.of() : desiredRoles.stream()
                .map(AdminAccessMutationSupportUtils::normalizeRoleKey)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        return currentNames.equals(desiredNames);
    }

    private boolean sameOrcaUserId(AdminAccessResource.OrcaLinkStatus existingLink, String requestedOrcaUserId) {
        String existing = existingLink != null ? trimToNull(existingLink.orcaUserId()) : null;
        String requested = trimToNull(requestedOrcaUserId);
        return Objects.equals(existing, requested);
    }

    private FacilityModel resolveFacility(String facilityId) {
        return em.createQuery("from FacilityModel f where f.facilityId=:fid", FacilityModel.class)
                .setParameter("fid", facilityId)
                .getSingleResult();
    }

    private boolean userExists(String userId) {
        List<Long> list = em.createQuery("select u.id from UserModel u where u.userId=:uid", Long.class)
                .setParameter("uid", userId)
                .setMaxResults(1)
                .getResultList();
        return !list.isEmpty();
    }

    private void requireSameFacility(AdminAccessResource resource, HttpServletRequest request, String facilityId, String targetUserId) {
        if (facilityId == null || facilityId.isBlank() || targetUserId == null) {
            throw resource.restError(request, Response.Status.FORBIDDEN, "forbidden", "対象ユーザーの施設境界が不明です。");
        }
        if (!targetUserId.startsWith(facilityId + IInfoModel.COMPOSITE_KEY_MAKER)) {
            throw resource.restError(request, Response.Status.FORBIDDEN, "facility_mismatch", "他施設のユーザーは操作できません。");
        }
    }

    private AdminAccessResource.OrcaLinkStatus findOrcaLinkByUserPk(String facilityId, long userPk) {
        if (!isOrcaLinkTablePresent()) {
            return null;
        }
        OrcaUserLinkQueryService.OrcaLinkRow row = orcaUserLinks().findLinkByUserPk(facilityId, userPk);
        if (row == null) {
            return null;
        }
        return new AdminAccessResource.OrcaLinkStatus(row.orcaUserId(), toIsoTimestamp(row.updatedAt()));
    }

    private AdminAccessResource.OrcaLinkStatus upsertOrcaLink(
            AdminAccessResource resource,
            HttpServletRequest request,
            long userPk,
            String orcaUserId,
            String actor) {
        requireOrcaLinkTableAvailable(resource, request);
        String facilityId = resource.getRemoteFacility(actor);
        Long owner = findOwnerByOrcaUserId(facilityId, orcaUserId);
        if (owner != null && owner.longValue() != userPk) {
            throw resource.restError(request, Response.Status.CONFLICT, "orca_user_already_linked",
                    "指定した ORCA User_Id は別の電子カルテユーザーにリンク済みです。");
        }

        Instant now = Instant.now();
        orcaUserLinks().upsertLink(facilityId, userPk, orcaUserId, now, actor);
        return new AdminAccessResource.OrcaLinkStatus(orcaUserId, now.toString());
    }

    private void requireOrcaLinkTableAvailable(AdminAccessResource resource, HttpServletRequest request) {
        if (isOrcaLinkTablePresent()) {
            return;
        }
        throw resource.restError(request, Response.Status.SERVICE_UNAVAILABLE,
                "orca_link_table_missing",
                "ORCAユーザー連携テーブルが存在しません。Flyway migration を適用してください。");
    }

    private boolean isOrcaLinkTablePresent() {
        return orcaUserLinks().isLinkTablePresent();
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

    private void validateTemporaryPassword(AdminAccessResource resource, HttpServletRequest request, String temporaryPassword) {
        String candidate = trimToNull(temporaryPassword);
        if (candidate == null) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "temporary_password_required",
                    "temporaryPassword は必須です。");
        }
        if (candidate.length() < 12) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "temporary_password_weak",
                    "temporaryPassword は 12 文字以上で指定してください。");
        }
        if (!UPPERCASE_PATTERN.matcher(candidate).matches()
                || !LOWERCASE_PATTERN.matcher(candidate).matches()
                || !DIGIT_PATTERN.matcher(candidate).matches()
                || !SYMBOL_PATTERN.matcher(candidate).matches()) {
            throw resource.restError(request, Response.Status.BAD_REQUEST, "temporary_password_weak",
                    "temporaryPassword は英大文字・英小文字・数字・記号をすべて含めてください。");
        }
    }

    private record CreateUserInput(
            String loginId,
            String password,
            String displayName,
            String sex,
            String staffRole,
            String sirName,
            String givenName,
            String email,
            List<String> roles,
            String orcaUserId
    ) {
    }

    private record UpdateUserInput(
            String displayName,
            String sirName,
            String givenName,
            String email,
            String sexToken,
            String staffRole,
            boolean rolesProvided,
            List<String> roles,
            String orcaUserId
    ) {
    }

}

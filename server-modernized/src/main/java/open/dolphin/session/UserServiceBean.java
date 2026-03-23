package open.dolphin.session;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.persistence.EntityExistsException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import open.dolphin.infomodel.*;
import open.dolphin.security.auth.LoginAttemptPolicyService;
import open.dolphin.security.auth.PasswordHashService;
import open.dolphin.session.framework.SessionOperation;

/**
 *
 * @author kazushi Minagawa, Digital Globe, Inc.
 */
@Named
@ApplicationScoped
@Transactional
@SessionOperation
public class UserServiceBean {
    private static final Logger LOGGER = Logger.getLogger("open.dolphin");

    private static final String QUERY_USER_BY_UID = "from UserModel u where u.userId=:uid";
    private static final String QUERY_USER_BY_FID_MEMBERTYPE = "from UserModel u where u.userId like :fid and u.memberType!=:memberType";

    private static final String UID = "uid";
    private static final String FID = "fid";
    private static final String MEMBER_TYPE = "memberType";
    private static final String MEMBER_TYPE_EXPIRED = "EXPIRED";

    @PersistenceContext
    private EntityManager em;

    // REQUIRES_NEW トランザクションを機能させるために self-injection を使用
    @Inject
    private UserServiceBean self;

    @Inject
    private PasswordHashService passwordHashService;

    public boolean authenticate(String userName, String password) {
        return authenticateWithPolicy(userName, password, null).authenticated();
    }

    public AuthenticationResult authenticateWithPolicy(String userName, String password, String clientIp) {
        if (userName == null || userName.isBlank() || password == null) {
            LoginAttemptPolicyService.FailureResult failure = registerFailure(userName, clientIp, Instant.now());
            if (failure.ipThrottled()) {
                return AuthenticationResult.ipThrottled(failure.retryAfterSeconds());
            }
            return AuthenticationResult.failure();
        }

        Instant now = Instant.now();
        LoginAttemptPolicyService.PreCheckResult preCheck = preCheck(userName, clientIp, now);
        if (preCheck.ipThrottled()) {
            return AuthenticationResult.ipThrottled(preCheck.retryAfterSeconds());
        }
        if (preCheck.accountLocked()) {
            LoginAttemptPolicyService.FailureResult failure = registerFailure(userName, clientIp, now);
            if (failure.ipThrottled()) {
                return AuthenticationResult.ipThrottled(failure.retryAfterSeconds());
            }
            return AuthenticationResult.failure();
        }

        try {
            UserModel user = (UserModel)
                em.createQuery(QUERY_USER_BY_UID)
                  .setParameter(UID, userName)
                  .getSingleResult();

            String storedPassword = user.getPassword();
            if (!hashService().isCurrentHash(storedPassword)) {
                LOGGER.log(Level.WARNING, "Authentication rejected for {0}: stored password format is not current", userName);
                LoginAttemptPolicyService.FailureResult failure = registerFailure(userName, clientIp, now);
                if (failure.ipThrottled()) {
                    return AuthenticationResult.ipThrottled(failure.retryAfterSeconds());
                }
                return AuthenticationResult.failure();
            }

            PasswordHashService.VerificationResult verification = hashService().verify(storedPassword, password);
            if (!verification.matched()) {
                LOGGER.log(Level.INFO, "Authentication rejected for {0}: password mismatch", userName);
                LoginAttemptPolicyService.FailureResult failure = registerFailure(userName, clientIp, now);
                if (failure.ipThrottled()) {
                    return AuthenticationResult.ipThrottled(failure.retryAfterSeconds());
                }
                return AuthenticationResult.failure();
            }

            if (requiresSecondFactor(user)) {
                registerSuccess(userName, now);
                return AuthenticationResult.needsSecondFactor();
            }
            registerSuccess(userName, now);
            return AuthenticationResult.success();
        } catch (NoResultException e) {
            LOGGER.log(Level.INFO, "Authentication rejected for {0}: user not found", userName);
            LoginAttemptPolicyService.FailureResult failure = registerFailure(userName, clientIp, now);
            if (failure.ipThrottled()) {
                return AuthenticationResult.ipThrottled(failure.retryAfterSeconds());
            }
            return AuthenticationResult.failure();
        } catch (Exception e) {
            LOGGER.log(Level.WARNING, "Authentication failed for " + userName + " due to internal error", e);
            LoginAttemptPolicyService.FailureResult failure = registerFailure(userName, clientIp, now);
            if (failure.ipThrottled()) {
                return AuthenticationResult.ipThrottled(failure.retryAfterSeconds());
            }
            return AuthenticationResult.failure();
        }
    }

    /**
     * 施設管理者が院内Userを登録する。
     * @param add 登録するUser
     * @return 
     */
    public int addUser(UserModel add) {
        try {
            // 既存ユーザの場合は例外をスローする
            getUser(add.getUserId());
            throw new EntityExistsException();
        } catch (NoResultException e) {
        }

        // 施設IDからFacilityModelを取得して設定する
        String fid = add.getFacilityModel().getFacilityId();
        FacilityModel facility = (FacilityModel) em.createQuery("from FacilityModel f where f.facilityId = :fid")
                                                   .setParameter("fid", fid)
                                                   .getSingleResult();
        add.setFacilityModel(facility);
        add.setPassword(normalizePasswordForStorage(add.getPassword(), null));

        // role を detach してから User を persist
        List<RoleModel> roles = add.getRoles();
        add.setRoles(null);

        // UserModel を Native SQL で直接 INSERT し、確実に DB に保存
        long userId = insertUserWithNativeSQL(add);
        add.setId(userId);

        // User が DB に保存されたので、role を re-attach して persist
        if (roles != null) {
            add.setRoles(roles);
            for (RoleModel role : roles) {
                role.setUserModel(add);
                role.setUserId(add.getUserId());
                em.persist(role);
            }
        }

        return 1;
    }

    /**
     * UserModel を Native SQL で直接 INSERT する
     * Hibernate の遅延 INSERT 問題を完全に回避するため、
     * Native SQL を使用して確実にデータベースへ保存する
     */
    private long insertUserWithNativeSQL(UserModel user) {
        // ID を手動生成
        Number nextId = (Number) em.createNativeQuery("select nextval('d_users_seq')").getSingleResult();
        long userId = nextId.longValue();
        
        // Native SQL で直接 INSERT
        String sql = "INSERT INTO d_users (" +
                "id, userId, commonName, sirName, givenName, email, " +
                "password, facility_id, memberType, registeredDate, " +
                "license, licenseDesc, licenseCodeSys, " +
                "department, departmentDesc, departmentCodeSys) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        em.createNativeQuery(sql)
          .setParameter(1, userId)
          .setParameter(2, user.getUserId())
          .setParameter(3, user.getCommonName())
          .setParameter(4, user.getSirName())
          .setParameter(5, user.getGivenName())
          .setParameter(6, user.getEmail())
          .setParameter(7, user.getPassword())
          .setParameter(8, user.getFacilityModel().getId())
          .setParameter(9, user.getMemberType())
          .setParameter(10, user.getRegisteredDateAsString())
          .setParameter(11, user.getLicenseModel() != null ? user.getLicenseModel().getLicense() : null)
          .setParameter(12, user.getLicenseModel() != null ? user.getLicenseModel().getLicenseDesc() : null)
          .setParameter(13, user.getLicenseModel() != null ? user.getLicenseModel().getLicenseCodeSys() : null)
          .setParameter(14, user.getDepartmentModel() != null ? user.getDepartmentModel().getDepartment() : null)
          .setParameter(15, user.getDepartmentModel() != null ? user.getDepartmentModel().getDepartmentDesc() : null)
          .setParameter(16, user.getDepartmentModel() != null ? user.getDepartmentModel().getDepartmentCodeSys() : null)
          .executeUpdate();
        
        em.flush();
        
        return userId;
    }

    /**
     * Userを検索する。
     * @param uid
     * @return 該当するUser
     */
    public UserModel getUser(String uid) {
        UserModel user = (UserModel)
                em.createQuery(QUERY_USER_BY_UID)
                  .setParameter(UID, uid)
                  .getSingleResult();

        if (user.getMemberType() != null && user.getMemberType().equals(MEMBER_TYPE_EXPIRED)) {
            throw new SecurityException("Expired User");
        }
        return user;
    }

    public UserModel getUserByPk(long userPk) {
        UserModel user = em.find(UserModel.class, userPk);
        if (user != null && user.getMemberType() != null && user.getMemberType().equals(MEMBER_TYPE_EXPIRED)) {
            throw new SecurityException("Expired User");
        }
        return user;
    }

    public FacilityModel getFacilityByPk(long facilityPk) {
        if (facilityPk <= 0) {
            return null;
        }
        return em.find(FacilityModel.class, facilityPk);
    }

    /**
     * 施設内の全Userを取得する。
     *
     * @return 施設内ユーザリスト
     */
    public List<UserModel> getAllUser(String fid) {

        List<UserModel> results =
                (List<UserModel>)em.createQuery(QUERY_USER_BY_FID_MEMBERTYPE)
                                         .setParameter(FID, fid+":%")
                                         .setParameter(MEMBER_TYPE, MEMBER_TYPE_EXPIRED)
                                         .getResultList();
        return results;

//        Collection<UserModel> ret = new ArrayList<UserModel>();
//        for (Iterator iter = results.iterator(); iter.hasNext(); ) {
//            UserModel user = (UserModel) iter.next();
//            if (user.getMemberType() != null && (!user.getMemberType().equals("EXPIRED"))) {
//                ret.add(user);
//            }
//        }
//        return ret;
    }

    /**
     * User情報(パスワード等)を更新する。
     * @param update 更新するUser detuched
     * @return 
     */
    public int updateUser(UserModel update) {
        UserModel current = (UserModel) em.find(UserModel.class, update.getId());
        update.setMemberType(current.getMemberType());
        update.setRegisteredDate(current.getRegisteredDate());
        update.setPassword(normalizePasswordForStorage(update.getPassword(), current.getPassword()));
        em.merge(update);
        return 1;
    }

    /**
     * Userを削除する。
     * @param removeId 削除するユーザのId
     * @return 
     */
    public int removeUser(String removeId) {

        //
        // 削除するユーザを得る
        //
        UserModel remove = getUser(removeId);

        // Stamp を削除する
        Collection<StampModel> stamps = (Collection<StampModel>) em.createQuery("from StampModel s where s.userId = :pk")
                                                                   .setParameter("pk", remove.getId())
                                                                   .getResultList();
        stamps.stream().forEach((stamp) -> {
            em.remove(stamp);
        });

        // Subscribed Tree を削除する
        Collection<SubscribedTreeModel> subscribedTrees = (Collection<SubscribedTreeModel>)
                                                          em.createQuery("from SubscribedTreeModel s where s.user.id = :pk")
                                                            .setParameter("pk", remove.getId())
                                                            .getResultList();
        subscribedTrees.stream().forEach((tree) -> {
            em.remove(tree);
        });

        // PublishedTree を削除する
        Collection<PublishedTreeModel> publishedTrees = (Collection<PublishedTreeModel>)
                                                         em.createQuery("from PublishedTreeModel p where p.user.id = :pk")
                                                           .setParameter("pk", remove.getId())
                                                           .getResultList();
        publishedTrees.stream().forEach((tree) -> {
            em.remove(tree);
        });

        // PersonalTreeを削除する
        Collection<StampTreeModel> stampTree = (Collection<StampTreeModel>) em.createQuery("from StampTreeModel s where s.user.id = :pk")
                                                      .setParameter("pk", remove.getId())
                                                      .getResultList();
        stampTree.stream().forEach((tree) -> {
            em.remove(tree);
        });

        //
        // ユーザを削除する
        //
        if (remove.getLicenseModel().getLicense().equals("doctor")) {
            StringBuilder sb = new StringBuilder();
            remove.setMemo(sb.toString());
            remove.setMemberType(MEMBER_TYPE_EXPIRED);
            remove.setPassword(hashService().hashRaw(UUID.randomUUID().toString()));
        } else {
            em.remove(remove);
        }

        return 1;
    }

    /**
     * 施設情報を更新する。
     * @param update 更新するUser detuched
     * @return 
     */
    public int updateFacility(UserModel update) {
        FacilityModel updateFacility = update.getFacilityModel();
        FacilityModel current = (FacilityModel) em.find(FacilityModel.class, updateFacility.getId());
        updateFacility.setMemberType(current.getMemberType());
        updateFacility.setRegisteredDate(current.getRegisteredDate());
        em.merge(updateFacility );
        return 1;
    }

    /**
     * 旧パスワード保存形式ユーザー数（新方式以外）を返す。
     */
    public long countLegacyPasswordHashUsers() {
        Number count = em.createQuery(
                        "select count(u.id) from UserModel u "
                                + "where u.password is null or u.password not like :prefix",
                        Number.class)
                .setParameter("prefix", PasswordHashService.FORMAT_PREFIX + "$%")
                .getSingleResult();
        return count != null ? count.longValue() : 0L;
    }
    
//s.oh^ 脆弱性対応
    public String getUserName(String userId) {
        UserModel user = (UserModel)em.createQuery(QUERY_USER_BY_UID).setParameter(UID, userId).getSingleResult();
        if(user.getMemberType() != null && user.getMemberType().equals(MEMBER_TYPE_EXPIRED)) {
            throw new SecurityException("Expired User");
        }
        return user.getCommonName();
    }
    
    public boolean isAdmin(String userId) {
        return hasRole(userId, true);
    }

    public boolean isSystemAdmin(String userId) {
        return hasRole(userId, false);
    }

    public boolean checkAuthority(String userId, String password, Collection<RoleModel> checkRoles) {
        boolean err = false;
        try {
            boolean admin = false;
            UserModel user = (UserModel)em.createQuery(QUERY_USER_BY_UID).setParameter(UID, userId).getSingleResult();
            for(RoleModel model : user.getRoles()) {
                if (hasAdministrativePrivilegeRole(model.getRole())) {
                    admin = true;
                    break;
                }
            }
            if(!admin) {
                // ユーザがadmin権限以外の場合は不正のチェック
                for(RoleModel model : checkRoles) {
                    if (hasAdministrativePrivilegeRole(model.getRole())) {
                        // 権限の昇格は不正
                        err = true;
                        break;
                    }
                }
            }
        } catch (Exception e) {
        }

        return !err;
    }

    private PasswordHashService hashService() {
        if (passwordHashService == null) {
            passwordHashService = new PasswordHashService();
        }
        return passwordHashService;
    }

    private LoginAttemptPolicyService rateLimitService() {
        return loginAttemptPolicyService;
    }

    private LoginAttemptPolicyService.PreCheckResult preCheck(String userName, String clientIp, Instant now) {
        LoginAttemptPolicyService service = rateLimitService();
        if (service == null) {
            return LoginAttemptPolicyService.PreCheckResult.allowed();
        }
        return service.preCheck(userName, clientIp, now);
    }

    private LoginAttemptPolicyService.FailureResult registerFailure(String userName, String clientIp, Instant now) {
        LoginAttemptPolicyService service = rateLimitService();
        if (service == null) {
            return new LoginAttemptPolicyService.FailureResult(false, false, 0L);
        }
        return service.registerFailure(userName, clientIp, now);
    }

    private void registerSuccess(String userName, Instant now) {
        LoginAttemptPolicyService service = rateLimitService();
        if (service == null) {
            return;
        }
        service.registerSuccess(userName, now);
    }

    private String normalizePasswordForStorage(String requestedPassword, String currentPassword) {
        if (requestedPassword == null || requestedPassword.isBlank()) {
            return currentPassword;
        }
        if (hashService().isCurrentHash(requestedPassword)) {
            return requestedPassword;
        }
        if (hashService().isLegacyManagedHash(requestedPassword) || hashService().isLegacyMd5Digest(requestedPassword)) {
            throw new IllegalArgumentException("Legacy password hashes are not accepted.");
        }
        return hashService().hashForStorage(requestedPassword);
    }

    private boolean requiresSecondFactor(UserModel user) {
        if (user == null) {
            return false;
        }
        String factor2Auth = user.getFactor2Auth();
        if (factor2Auth == null) {
            return false;
        }
        String normalized = factor2Auth.trim();
        if (normalized.isEmpty() || "off".equalsIgnoreCase(normalized)) {
            return false;
        }
        if ("totp".equalsIgnoreCase(normalized)) {
            return true;
        }
        throw new IllegalStateException("Unsupported factor2Auth mode: " + normalized);
    }

    private boolean isAdminRole(String role) {
        if (role == null) {
            return false;
        }
        String normalized = role.trim().toLowerCase(java.util.Locale.ROOT);
        return normalized.equals("admin");
    }

    private boolean isSystemAdminRole(String role) {
        if (role == null) {
            return false;
        }
        String normalized = role.trim().toLowerCase(java.util.Locale.ROOT);
        return normalized.equals("system_admin")
                || normalized.equals("system-admin")
                || normalized.equals("system-administrator")
                || normalized.equals("system_administrator");
    }

    private boolean hasAdministrativePrivilegeRole(String role) {
        return isAdminRole(role) || isSystemAdminRole(role);
    }

    private boolean hasRole(String userId, boolean includeAdmin) {
        try {
            UserModel user = (UserModel) em.createQuery(QUERY_USER_BY_UID).setParameter(UID, userId).getSingleResult();
            for (RoleModel model : user.getRoles()) {
                String role = model != null ? model.getRole() : null;
                if (includeAdmin) {
                    if (hasAdministrativePrivilegeRole(role)) {
                        return true;
                    }
                    continue;
                }
                if (isSystemAdminRole(role)) {
                    return true;
                }
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    @Inject
    private LoginAttemptPolicyService loginAttemptPolicyService;

    public enum AuthenticationState {
        SUCCESS,
        FAILURE,
        IP_THROTTLED,
        SECOND_FACTOR_REQUIRED
    }

    public record AuthenticationResult(AuthenticationState state, long retryAfterSeconds) {
        public static AuthenticationResult success() {
            return new AuthenticationResult(AuthenticationState.SUCCESS, 0L);
        }

        public static AuthenticationResult failure() {
            return new AuthenticationResult(AuthenticationState.FAILURE, 0L);
        }

        public static AuthenticationResult ipThrottled(long retryAfterSeconds) {
            return new AuthenticationResult(AuthenticationState.IP_THROTTLED, Math.max(1L, retryAfterSeconds));
        }

        public static AuthenticationResult needsSecondFactor() {
            return new AuthenticationResult(AuthenticationState.SECOND_FACTOR_REQUIRED, 0L);
        }

        public boolean authenticated() {
            return state == AuthenticationState.SUCCESS;
        }

        public boolean ipThrottled() {
            return state == AuthenticationState.IP_THROTTLED;
        }

        public boolean secondFactorRequired() {
            return state == AuthenticationState.SECOND_FACTOR_REQUIRED;
        }
    }
//s.oh$
}

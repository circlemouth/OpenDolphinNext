package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.List;
import open.dolphin.infomodel.FacilityModel;
import open.dolphin.infomodel.RoleModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.session.UserServiceBean;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SessionAuthResourceTest extends RuntimeDelegateTestSupport {

    private static final String USER_ID = "F001:user01";

    private SessionAuthResource resource;
    private UserServiceBean userServiceBean;
    private TotpVerificationSupport totpVerificationSupport;

    @BeforeEach
    void setUp() throws Exception {
        resource = new SessionAuthResource();
        userServiceBean = mock(UserServiceBean.class);
        totpVerificationSupport = mock(TotpVerificationSupport.class);
        setField(resource, "userServiceBean", userServiceBean);
        setField(resource, "totpVerificationSupport", totpVerificationSupport);
    }

    @Test
    void loginEstablishesSessionAndReturnsSafeResponse() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = mock(HttpSession.class);
        when(request.getSession(true)).thenReturn(session);
        when(request.getSession(false)).thenReturn(session);
        when(request.getHeader("X-Run-Id")).thenReturn("run-123");
        when(request.getRemoteAddr()).thenReturn("192.0.2.10");
        when(request.getRequestURI()).thenReturn("/openDolphin/api/session/login");
        when(userServiceBean.authenticateWithPolicy(USER_ID, "plain-password", "192.0.2.10"))
                .thenReturn(UserServiceBean.AuthenticationResult.success());
        when(userServiceBean.getUser(USER_ID)).thenReturn(userWithRole(USER_ID, "system_admin"));

        Response response = resource.login(request,
                new SessionAuthResource.LoginRequest("F001", "user01", "plain-password", "client-1"));

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getHeaderString("Cache-Control")).isEqualTo("private, no-store, max-age=0, must-revalidate");
        AuthSessionSupport.SessionUserResponse entity = (AuthSessionSupport.SessionUserResponse) response.getEntity();
        assertThat(entity.facilityId()).isEqualTo("F001");
        assertThat(entity.userId()).isEqualTo(USER_ID);
        assertThat(entity.userPk()).isEqualTo(101L);
        assertThat(entity.clientUuid()).isEqualTo("client-1");
        assertThat(entity.runId()).isEqualTo("run-123");
        assertThat(entity.roles()).containsExactly("system_admin");
        verify(session).setAttribute(AuthSessionSupport.AUTH_ACTOR_ID, USER_ID);
        verify(session).setAttribute(AuthSessionSupport.AUTH_FACILITY_ID, "F001");
        verify(session).setAttribute(AuthSessionSupport.AUTH_LOGIN_ID, "user01");
    }

    @Test
    void loginReturns429WhenIpThrottled() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("192.0.2.20");
        when(request.getRequestURI()).thenReturn("/openDolphin/api/session/login");
        when(userServiceBean.authenticateWithPolicy(USER_ID, "plain-password", "192.0.2.20"))
                .thenReturn(UserServiceBean.AuthenticationResult.ipThrottled(90));

        Response response = resource.login(request,
                new SessionAuthResource.LoginRequest("F001", "user01", "plain-password", null));

        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getHeaderString("Retry-After")).isEqualTo("90");
    }

    @Test
    void loginReturnsFactor2RequiredAndStoresPendingSession() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = mock(HttpSession.class);
        when(request.getSession(true)).thenReturn(session);
        when(request.getSession(false)).thenReturn(session);
        when(request.getRemoteAddr()).thenReturn("192.0.2.30");
        when(request.getRequestURI()).thenReturn("/openDolphin/api/session/login");
        when(userServiceBean.authenticateWithPolicy(USER_ID, "plain-password", "192.0.2.30"))
                .thenReturn(UserServiceBean.AuthenticationResult.needsSecondFactor());

        Response response = resource.login(request,
                new SessionAuthResource.LoginRequest("F001", "user01", "plain-password", "client-2"));

        assertThat(response.getStatus()).isEqualTo(401);
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> body = (java.util.Map<String, Object>) response.getEntity();
        assertThat(body)
                .containsEntry("error", "factor2_required")
                .containsEntry("code", "factor2_required")
                .containsEntry("errorCode", "factor2_required")
                .containsEntry("message", "二要素認証コードを入力してください。")
                .containsEntry("status", 401)
                .containsEntry("errorCategory", "factor2_required")
                .containsEntry("factor2Required", true)
                .containsEntry("factor2Type", "totp");
        verify(session).setAttribute(AuthSessionSupport.PENDING_FACTOR2_ACTOR_ID, USER_ID);
        verify(session).setAttribute(AuthSessionSupport.PENDING_FACTOR2_FACILITY_ID, "F001");
        verify(session).setAttribute(AuthSessionSupport.PENDING_FACTOR2_LOGIN_ID, "user01");
        verify(session, never()).setAttribute(AuthSessionSupport.AUTH_ACTOR_ID, USER_ID);
    }

    @Test
    void loginFactor2EstablishesAuthenticatedSession() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession pendingSession = mock(HttpSession.class);
        HttpSession authenticatedSession = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(pendingSession);
        when(request.getSession(true)).thenReturn(authenticatedSession);
        when(request.getHeader("X-Run-Id")).thenReturn("run-factor2");
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_ACTOR_ID)).thenReturn(USER_ID);
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_FACILITY_ID)).thenReturn("F001");
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_LOGIN_ID)).thenReturn("user01");
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_CLIENT_UUID)).thenReturn("client-3");
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_CREATED_AT)).thenReturn(java.time.Instant.now().toString());
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_ATTEMPT_COUNT)).thenReturn(0);
        UserModel user = userWithRole(USER_ID, "doctor");
        user.setId(77L);
        when(userServiceBean.getUser(USER_ID)).thenReturn(user);
        when(totpVerificationSupport.verifyCurrentCode(77L, "654321"))
                .thenReturn(TotpVerificationSupport.VerificationResult.success());

        Response response = resource.loginFactor2(request, new SessionAuthResource.LoginFactor2Request("654321"));

        assertThat(response.getStatus()).isEqualTo(200);
        AuthSessionSupport.SessionUserResponse entity = (AuthSessionSupport.SessionUserResponse) response.getEntity();
        assertThat(entity.userId()).isEqualTo(USER_ID);
        assertThat(entity.clientUuid()).isEqualTo("client-3");
        assertThat(entity.runId()).isEqualTo("run-factor2");
        verify(authenticatedSession, atLeastOnce()).removeAttribute(AuthSessionSupport.PENDING_FACTOR2_ACTOR_ID);
        verify(authenticatedSession).setAttribute(AuthSessionSupport.AUTH_ACTOR_ID, USER_ID);
        verify(authenticatedSession).setAttribute(AuthSessionSupport.AUTH_FACILITY_ID, "F001");
        verify(authenticatedSession).setAttribute(AuthSessionSupport.AUTH_LOGIN_ID, "user01");
    }

    @Test
    void loginFactor2RejectsInvalidCodeWithoutAuthenticating() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession pendingSession = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(pendingSession);
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_ACTOR_ID)).thenReturn(USER_ID);
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_FACILITY_ID)).thenReturn("F001");
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_LOGIN_ID)).thenReturn("user01");
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_CLIENT_UUID)).thenReturn("client-3");
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_CREATED_AT)).thenReturn(java.time.Instant.now().toString());
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_ATTEMPT_COUNT)).thenReturn(0);
        UserModel user = userWithRole(USER_ID, "doctor");
        user.setId(77L);
        when(userServiceBean.getUser(USER_ID)).thenReturn(user);
        when(totpVerificationSupport.verifyCurrentCode(77L, "000000"))
                .thenReturn(TotpVerificationSupport.VerificationResult.invalid());

        Response response = resource.loginFactor2(request, new SessionAuthResource.LoginFactor2Request("000000"));

        assertThat(response.getStatus()).isEqualTo(401);
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> body = (java.util.Map<String, Object>) response.getEntity();
        assertThat(body)
                .containsEntry("error", "factor2_invalid")
                .containsEntry("code", "factor2_invalid")
                .containsEntry("errorCode", "factor2_invalid")
                .containsEntry("message", "認証コードが正しくありません。")
                .containsEntry("status", 401)
                .containsEntry("errorCategory", "factor2_invalid");
        verify(pendingSession).setAttribute(AuthSessionSupport.PENDING_FACTOR2_ATTEMPT_COUNT, 1);
        verify(pendingSession, never()).setAttribute(AuthSessionSupport.AUTH_ACTOR_ID, USER_ID);
    }

    @Test
    void loginFactor2ReturnsMissingWhenPendingSessionAbsent() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getSession(false)).thenReturn(null);

        Response response = resource.loginFactor2(request, new SessionAuthResource.LoginFactor2Request("123456"));

        assertThat(response.getStatus()).isEqualTo(401);
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> body = (java.util.Map<String, Object>) response.getEntity();
        assertThat(body).containsEntry("error", "factor2_session_missing");
    }

    @Test
    void loginFactor2ReturnsExpiredWhenPendingSessionTimedOut() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession pendingSession = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(pendingSession);
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_ACTOR_ID)).thenReturn(USER_ID);
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_FACILITY_ID)).thenReturn("F001");
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_LOGIN_ID)).thenReturn("user01");
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_CREATED_AT))
                .thenReturn(java.time.Instant.now().minus(java.time.Duration.ofMinutes(6)).toString());
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_ATTEMPT_COUNT)).thenReturn(0);

        Response response = resource.loginFactor2(request, new SessionAuthResource.LoginFactor2Request("123456"));

        assertThat(response.getStatus()).isEqualTo(401);
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> body = (java.util.Map<String, Object>) response.getEntity();
        assertThat(body).containsEntry("error", "factor2_session_expired");
        verify(pendingSession).removeAttribute(AuthSessionSupport.PENDING_FACTOR2_ACTOR_ID);
    }

    @Test
    void loginFactor2ReturnsExpiredWhenAttemptLimitAlreadyReached() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession pendingSession = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(pendingSession);
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_ACTOR_ID)).thenReturn(USER_ID);
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_FACILITY_ID)).thenReturn("F001");
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_LOGIN_ID)).thenReturn("user01");
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_CREATED_AT)).thenReturn(java.time.Instant.now().toString());
        when(pendingSession.getAttribute(AuthSessionSupport.PENDING_FACTOR2_ATTEMPT_COUNT))
                .thenReturn(AuthSessionSupport.PENDING_SECOND_FACTOR_MAX_ATTEMPTS);

        Response response = resource.loginFactor2(request, new SessionAuthResource.LoginFactor2Request("123456"));

        assertThat(response.getStatus()).isEqualTo(401);
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> body = (java.util.Map<String, Object>) response.getEntity();
        assertThat(body).containsEntry("error", "factor2_session_expired");
    }

    @Test
    void meRequiresAuthenticatedSession() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getSession(false)).thenReturn(null);

        assertThatThrownBy(() -> resource.me(request))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(401));
    }

    @Test
    void meReloadsCurrentUserStateFromDatabase() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(AuthSessionSupport.AUTH_ACTOR_ID)).thenReturn(USER_ID);
        when(session.getAttribute(AuthSessionSupport.AUTH_CLIENT_UUID)).thenReturn("client-2");
        when(userServiceBean.getUser(USER_ID)).thenReturn(userWithRole(USER_ID, "user"));

        Response response = resource.me(request);

        assertThat(response.getStatus()).isEqualTo(200);
        AuthSessionSupport.SessionUserResponse entity = (AuthSessionSupport.SessionUserResponse) response.getEntity();
        assertThat(entity.userPk()).isEqualTo(101L);
        assertThat(entity.roles()).containsExactly("user");
        assertThat(entity.clientUuid()).isEqualTo("client-2");
    }

    private static UserModel userWithRole(String userId, String roleValue) {
        RoleModel role = new RoleModel();
        role.setRole(roleValue);
        FacilityModel facility = new FacilityModel();
        facility.setFacilityId("F001");
        UserModel user = new UserModel();
        user.setId(101L);
        user.setUserId(userId);
        user.setCommonName("Doctor One");
        user.setFacilityModel(facility);
        user.setRoles(List.of(role));
        return user;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

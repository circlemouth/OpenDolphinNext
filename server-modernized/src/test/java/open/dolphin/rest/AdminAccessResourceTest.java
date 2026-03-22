package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.UserModel;
import open.dolphin.security.auth.PasswordHashService;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AdminAccessResourceTest {

    private AdminAccessResource resource;
    private HttpServletRequest request;
    private UserServiceBean userServiceBean;
    private EntityManager entityManager;
    private PasswordHashService passwordHashService;

    @BeforeEach
    void setUp() throws Exception {
        resource = new TestableAdminAccessResource();
        request = mock(HttpServletRequest.class);
        userServiceBean = mock(UserServiceBean.class);
        entityManager = mock(EntityManager.class);
        passwordHashService = mock(PasswordHashService.class);

        setField(resource, "em", entityManager);
        setField(resource, "userServiceBean", userServiceBean);
        setField(resource, "totpVerificationSupport", mock(TotpVerificationSupport.class));
        setField(resource, "sessionAuditDispatcher", mock(SessionAuditDispatcher.class));
        setField(resource, "passwordHashService", passwordHashService);
    }

    @Test
    void listUsersRejectsWhenUnauthenticated() {
        when(request.getRemoteUser()).thenReturn(null);
        try {
            resource.listUsers(request);
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(401, ex.getResponse().getStatus());
        }
    }

    @Test
    void listUsersRejectsWhenNotAdmin() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-TEST");
        when(request.getRemoteUser()).thenReturn("FACILITY:testuser");
        when(userServiceBean.isAdmin("FACILITY:testuser")).thenReturn(false);
        try {
            resource.listUsers(request);
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(403, ex.getResponse().getStatus());
        }
    }

    @Test
    void listUsersReturnsEmptyListForAdmin() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-TEST");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);
        when(userServiceBean.getAllUser("FACILITY")).thenReturn(List.of());

        Response response = resource.listUsers(request);
        assertEquals(200, response.getStatus());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertNotNull(body);
        assertEquals("RUN-TEST", body.get("runId"));
        assertEquals("FACILITY", body.get("facilityId"));
        @SuppressWarnings("unchecked")
        List<Object> users = (List<Object>) body.get("users");
        assertNotNull(users);
        assertTrue(users.isEmpty());
    }

    @Test
    void createUserRejectsWhenUnauthenticated() {
        when(request.getRemoteUser()).thenReturn(null);
        try {
            resource.createUser(request, Map.of("loginId", "user01"));
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(401, ex.getResponse().getStatus());
        }
    }

    @Test
    void createUserRejectsWhenNotAdmin() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-TEST");
        when(request.getRemoteUser()).thenReturn("FACILITY:user01");
        when(userServiceBean.isAdmin("FACILITY:user01")).thenReturn(false);
        try {
            resource.createUser(request, Map.of("loginId", "user01"));
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(403, ex.getResponse().getStatus());
        }
    }

    @Test
    void createUserRejectsInvalidLoginId() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-TEST");
        when(request.getRemoteUser()).thenReturn("F001:admin");
        when(userServiceBean.isAdmin("F001:admin")).thenReturn(true);
        try {
            resource.createUser(request, Map.of(
                    "loginId", "bad id",
                    "password", "TempPass123!",
                    "displayName", "Test User"));
            fail("Expected WebApplicationException");
        } catch (WebApplicationException ex) {
            assertEquals(400, ex.getResponse().getStatus());
        }
    }

    @Test
    void resetPasswordReturnsNoContentAndNoSecretInResponse() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-TEST");
        when(request.getRemoteUser()).thenReturn("F001:admin");
        when(userServiceBean.isAdmin("F001:admin")).thenReturn(true);

        UserModel target = new UserModel();
        target.setId(10L);
        target.setUserId("F001:user01");
        when(entityManager.find(UserModel.class, 10L)).thenReturn(target);
        when(passwordHashService.hashForStorage("TempPass123!")).thenReturn("hashed-password");

        Response response = resource.resetPassword(
                request,
                10L,
                Map.of("totpCode", "123456", "temporaryPassword", "TempPass123!"));

        assertEquals(204, response.getStatus());
        assertEquals("no-store", response.getHeaderString("Cache-Control"));
        assertEquals("no-cache", response.getHeaderString("Pragma"));
        assertNull(response.getEntity());
        assertEquals("hashed-password", target.getPassword());
        verify(entityManager).merge(target);
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Class<?> type = target.getClass();
        while (type != null) {
            try {
                Field field = type.getDeclaredField(name);
                field.setAccessible(true);
                field.set(target, value);
                return;
            } catch (NoSuchFieldException ignore) {
                type = type.getSuperclass();
            }
        }
        throw new NoSuchFieldException(name);
    }

    private static final class TestableAdminAccessResource extends AdminAccessResource {
        @Override
        protected void verifyAdminTotp(HttpServletRequest request, long actorPk, String totpCode) {
            // no-op for unit tests
        }

        @Override
        protected long resolveActorUserPk(String actorUserId) {
            return 1L;
        }

        @Override
        protected UserAccessProfileRow upsertProfile(
                long userPk, String sex, String staffRole, Boolean mustChangePassword, java.time.Instant now) {
            return null;
        }
    }
}

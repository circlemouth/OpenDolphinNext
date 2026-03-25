package open.dolphin.security.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.container.ContainerRequestContext;
import java.time.Instant;
import open.dolphin.rest.AuthSessionSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class AuthSessionRegistryFilterTest {

    private AuthSessionRegistryFilter filter;
    private AuthSessionRegistryService authSessionRegistryService;
    private HttpServletRequest request;
    private ContainerRequestContext requestContext;

    @BeforeEach
    void setUp() throws Exception {
        filter = new AuthSessionRegistryFilter();
        authSessionRegistryService = mock(AuthSessionRegistryService.class);
        request = mock(HttpServletRequest.class);
        requestContext = mock(ContainerRequestContext.class);
        setField(filter, "authSessionRegistryService", authSessionRegistryService);
        setField(filter, "request", request);
    }

    @Test
    void filterAllowsValidAuthenticatedSession() {
        HttpSession session = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(AuthSessionSupport.AUTH_ACTOR_ID)).thenReturn("F001:admin");
        AuthSessionRegistryRepository.SessionRow row = new AuthSessionRegistryRepository.SessionRow(
                "sess-1",
                101L,
                "F001:admin",
                "F001",
                "client-1",
                "password",
                Instant.parse("2026-03-25T10:00:00Z"),
                Instant.parse("2026-03-25T10:00:00Z"),
                null,
                null,
                0L,
                0L,
                null,
                null,
                null,
                Instant.parse("2026-03-25T10:00:00Z"));
        when(authSessionRegistryService.validateCurrentSession(session))
                .thenReturn(AuthSessionRegistryService.SessionValidationResult.valid(row));

        filter.filter(requestContext);

        verify(requestContext, never()).abortWith(org.mockito.ArgumentMatchers.any());
        verify(authSessionRegistryService).validateCurrentSession(session);
    }

    @Test
    void filterRevokesInvalidSession() {
        HttpSession session = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(AuthSessionSupport.AUTH_ACTOR_ID)).thenReturn("F001:admin");
        when(authSessionRegistryService.validateCurrentSession(session))
                .thenReturn(AuthSessionRegistryService.SessionValidationResult.revoked());

        filter.filter(requestContext);

        ArgumentCaptor<jakarta.ws.rs.core.Response> captor =
                ArgumentCaptor.forClass(jakarta.ws.rs.core.Response.class);
        verify(requestContext).abortWith(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(401);
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> body = (java.util.Map<String, Object>) captor.getValue().getEntity();
        assertThat(body)
                .containsEntry("error", "session_revoked")
                .containsEntry("code", "session_revoked")
                .containsEntry("status", 401);
        verify(session).invalidate();
    }

    @Test
    void filterIgnoresPendingSecondFactorSession() {
        HttpSession session = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(AuthSessionSupport.AUTH_ACTOR_ID)).thenReturn(null);

        filter.filter(requestContext);

        verify(authSessionRegistryService, never()).validateCurrentSession(session);
        verify(requestContext, never()).abortWith(org.mockito.ArgumentMatchers.any());
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        var field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}

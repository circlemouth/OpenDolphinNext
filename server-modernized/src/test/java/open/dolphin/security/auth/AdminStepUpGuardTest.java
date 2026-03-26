package open.dolphin.security.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import open.dolphin.rest.AuthSessionSupport;
import open.dolphin.security.audit.SessionAuditDispatcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AdminStepUpGuardTest {

    private AdminStepUpGuard guard;
    private SessionAuditDispatcher sessionAuditDispatcher;

    @BeforeEach
    void setUp() throws Exception {
        guard = new AdminStepUpGuard();
        sessionAuditDispatcher = mock(SessionAuditDispatcher.class);
        setField(guard, "sessionAuditDispatcher", sessionAuditDispatcher);
    }

    @Test
    void requirePassesWhenProofIsValid() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = mock(HttpSession.class);
        Instant verifiedAt = Instant.now().plus(10, ChronoUnit.MINUTES);
        Instant expiresAt = verifiedAt.plus(5, ChronoUnit.MINUTES);
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(AuthSessionSupport.AUTH_STEP_UP_SCOPE)).thenReturn("admin:mutation");
        when(session.getAttribute(AuthSessionSupport.AUTH_STEP_UP_VERIFIED_AT)).thenReturn(verifiedAt.toString());
        when(session.getAttribute(AuthSessionSupport.AUTH_STEP_UP_EXPIRES_AT)).thenReturn(expiresAt.toString());

        guard.require(request, "admin:mutation");
    }

    @Test
    void requireRejectsMissingProof() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(session);

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> guard.require(request, "admin:mutation"));

        assertThat(ex.getResponse().getStatus()).isEqualTo(412);
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> body = (java.util.Map<String, Object>) ex.getResponse().getEntity();
        assertThat(body)
                .containsEntry("error", "step_up_required")
                .containsEntry("code", "step_up_required")
                .containsEntry("requiredScope", "admin:mutation");
    }

    @Test
    void requireRejectsExpiredProof() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(AuthSessionSupport.AUTH_STEP_UP_SCOPE)).thenReturn("admin:mutation");
        when(session.getAttribute(AuthSessionSupport.AUTH_STEP_UP_VERIFIED_AT)).thenReturn("2026-03-25T10:00:00Z");
        when(session.getAttribute(AuthSessionSupport.AUTH_STEP_UP_EXPIRES_AT)).thenReturn(Instant.now().minusSeconds(1).toString());

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> guard.require(request, "admin:mutation"));

        assertThat(ex.getResponse().getStatus()).isEqualTo(412);
    }

    @Test
    void requireRejectsScopeMismatch() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(AuthSessionSupport.AUTH_STEP_UP_SCOPE)).thenReturn("admin:read");
        when(session.getAttribute(AuthSessionSupport.AUTH_STEP_UP_VERIFIED_AT)).thenReturn("2026-03-25T10:00:00Z");
        when(session.getAttribute(AuthSessionSupport.AUTH_STEP_UP_EXPIRES_AT)).thenReturn("2026-03-25T10:05:00Z");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> guard.require(request, "admin:mutation"));

        assertThat(ex.getResponse().getStatus()).isEqualTo(412);
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}

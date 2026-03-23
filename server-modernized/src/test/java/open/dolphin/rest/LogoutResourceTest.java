package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LogoutResourceTest {

    private LogoutResource resource;

    @BeforeEach
    void setUp() {
        resource = new LogoutResource();
    }

    @Test
    void logoutInvalidatesSessionAndExpiresCookie() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(session);
        when(request.getContextPath()).thenReturn("/openDolphin");
        when(request.isSecure()).thenReturn(true);

        Response response = resource.logout(request);

        verify(session).removeAttribute(AuthSessionSupport.AUTH_ACTOR_ID);
        verify(session).removeAttribute(AuthSessionSupport.AUTH_FACILITY_ID);
        verify(session).removeAttribute(AuthSessionSupport.AUTH_LOGIN_ID);
        verify(session).removeAttribute(AuthSessionSupport.AUTH_CLIENT_UUID);
        verify(session).removeAttribute(AuthSessionSupport.AUTH_AUTHENTICATED_AT);
        verify(session).removeAttribute(AuthSessionSupport.PENDING_FACTOR2_ACTOR_ID);
        verify(session).removeAttribute(AuthSessionSupport.PENDING_FACTOR2_FACILITY_ID);
        verify(session).removeAttribute(AuthSessionSupport.PENDING_FACTOR2_LOGIN_ID);
        verify(session).removeAttribute(AuthSessionSupport.PENDING_FACTOR2_CLIENT_UUID);
        verify(session).removeAttribute(AuthSessionSupport.PENDING_FACTOR2_CREATED_AT);
        verify(session).removeAttribute(AuthSessionSupport.PENDING_FACTOR2_ATTEMPT_COUNT);
        verify(session).invalidate();
        assertThat(response.getStatus()).isEqualTo(Response.Status.NO_CONTENT.getStatusCode());
        NewCookie cookie = response.getCookies().get("JSESSIONID");
        assertThat(cookie).isNotNull();
        assertThat(cookie.getMaxAge()).isZero();
        assertThat(cookie.getPath()).isEqualTo("/openDolphin");
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.isSecure()).isTrue();
        assertThat(response.getHeaderString("Cache-Control")).isEqualTo("private, no-store, max-age=0, must-revalidate");
        assertThat(response.getHeaderString("Pragma")).isEqualTo("no-cache");
        assertThat(response.getHeaderString("Expires")).isEqualTo("0");
        assertThat(response.getHeaderString("Clear-Site-Data")).isEqualTo("\"storage\"");
    }

    @Test
    void logoutIsIdempotentWithoutSession() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getSession(false)).thenReturn(null);
        when(request.getContextPath()).thenReturn("/openDolphin");
        when(request.isSecure()).thenReturn(false);

        Response response = resource.logout(request);

        assertThat(response.getStatus()).isEqualTo(Response.Status.NO_CONTENT.getStatusCode());
        NewCookie cookie = response.getCookies().get("JSESSIONID");
        assertThat(cookie).isNotNull();
        assertThat(cookie.getMaxAge()).isZero();
        assertThat(cookie.getPath()).isEqualTo("/openDolphin");
        assertThat(cookie.isSecure()).isFalse();
    }

    @Test
    void logoutUsesProxyAwareSecureCookieFlag() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getSession(false)).thenReturn(null);
        when(request.getContextPath()).thenReturn("/openDolphin");
        when(request.isSecure()).thenReturn(false);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("Forwarded")).thenReturn("proto=https;host=app.example.test");

        Response response = resource.logout(request);

        NewCookie cookie = response.getCookies().get("JSESSIONID");
        assertThat(cookie).isNotNull();
        assertThat(cookie.isSecure()).isTrue();
    }

    @Test
    void logoutIgnoresUntrustedForwardedSecureFlag() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getSession(false)).thenReturn(null);
        when(request.getContextPath()).thenReturn("/openDolphin");
        when(request.isSecure()).thenReturn(false);
        when(request.getRemoteAddr()).thenReturn("198.51.100.20");
        when(request.getHeader("Forwarded")).thenReturn("proto=https;host=app.example.test");

        Response response = resource.logout(request);

        NewCookie cookie = response.getCookies().get("JSESSIONID");
        assertThat(cookie).isNotNull();
        assertThat(cookie.isSecure()).isFalse();
    }
}

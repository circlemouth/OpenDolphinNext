package open.dolphin.rest;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SecurityHeadersFilterTest {

    private SecurityHeadersFilter filter;

    @BeforeEach
    void setUp() {
        filter = new SecurityHeadersFilter();
    }

    @Test
    void appliesSecurityHeadersToAllResponses() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.isSecure()).thenReturn(false);
        when(request.getScheme()).thenReturn("http");
        when(request.getServerName()).thenReturn("app.example.test");
        when(request.getServerPort()).thenReturn(8080);

        filter.doFilter(request, response, chain);

        verify(response).setHeader("Content-Security-Policy", SecurityHeadersFilter.CONTENT_SECURITY_POLICY);
        verify(response).setHeader("X-Frame-Options", "DENY");
        verify(response).setHeader("Referrer-Policy", "same-origin");
        verify(response).setHeader("X-Content-Type-Options", "nosniff");
        verify(response).setHeader("Permissions-Policy",
                "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()");
        verify(response, never()).setHeader("Strict-Transport-Security", SecurityHeadersFilter.HSTS_VALUE);
        verify(chain).doFilter(request, response);
    }

    @Test
    void attachesHstsForSecureForwardedRequests() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.isSecure()).thenReturn(false);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("Forwarded")).thenReturn("proto=https;host=app.example.test");

        filter.doFilter(request, response, chain);

        verify(response).setHeader("Strict-Transport-Security", SecurityHeadersFilter.HSTS_VALUE);
        verify(chain).doFilter(request, response);
    }

    @Test
    void skipsHstsForLocalhost() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.isSecure()).thenReturn(true);
        when(request.getScheme()).thenReturn("https");
        when(request.getServerName()).thenReturn("localhost");
        when(request.getServerPort()).thenReturn(8443);

        filter.doFilter(request, response, chain);

        verify(response, never()).setHeader("Strict-Transport-Security", SecurityHeadersFilter.HSTS_VALUE);
        verify(chain).doFilter(request, response);
    }

    @Test
    void ignoresForwardedHeadersFromUntrustedRemote() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.isSecure()).thenReturn(false);
        when(request.getRemoteAddr()).thenReturn("198.51.100.20");
        when(request.getHeader("Forwarded")).thenReturn("proto=https;host=app.example.test");
        when(request.getScheme()).thenReturn("http");
        when(request.getServerName()).thenReturn("internal.local");
        when(request.getServerPort()).thenReturn(8080);

        filter.doFilter(request, response, chain);

        verify(response, never()).setHeader("Strict-Transport-Security", SecurityHeadersFilter.HSTS_VALUE);
        verify(chain).doFilter(request, response);
    }
}

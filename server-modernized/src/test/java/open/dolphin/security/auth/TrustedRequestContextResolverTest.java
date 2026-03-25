package open.dolphin.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

class TrustedRequestContextResolverTest {

    @Test
    void ignoresSpoofedForwardedFromUntrustedRemote() {
        TrustedRequestContextResolver resolver = new TrustedRequestContextResolver(TrustedProxyPolicy.loopbackOnly());
        HttpServletRequest request = baseRequest("198.51.100.20", "http", "internal.local", 8080);
        when(request.getHeader("Forwarded")).thenReturn("for=203.0.113.10;proto=https;host=app.example.test");

        var context = resolver.resolve(request);

        assertEquals("198.51.100.20", context.clientIp());
        assertEquals("http", context.scheme());
        assertFalse(context.forwardedUsed());
    }

    @Test
    void acceptsValidForwardedFromTrustedRemote() {
        TrustedRequestContextResolver resolver =
                new TrustedRequestContextResolver(TrustedProxyPolicy.fromRules(java.util.List.of("10.0.0.0/8")));
        HttpServletRequest request = baseRequest("10.0.0.5", "http", "internal.local", 8080);
        when(request.getHeader("Forwarded")).thenReturn("for=203.0.113.10;proto=https;host=app.example.test");

        var context = resolver.resolve(request);

        assertEquals("203.0.113.10", context.clientIp());
        assertEquals("https", context.scheme());
        assertEquals("app.example.test", context.host());
        assertEquals(443, context.port());
        assertTrue(context.forwardedUsed());
    }

    @Test
    void acceptsLegacyForwardedHeadersWhenForwardedMissing() {
        TrustedRequestContextResolver resolver =
                new TrustedRequestContextResolver(TrustedProxyPolicy.fromRules(java.util.List.of("10.0.0.0/8")));
        HttpServletRequest request = baseRequest("10.0.0.5", "http", "internal.local", 8080);
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.10, 10.0.0.5");
        when(request.getHeader("X-Forwarded-Proto")).thenReturn("https");
        when(request.getHeader("X-Forwarded-Host")).thenReturn("app.example.test");

        var context = resolver.resolve(request);

        assertEquals("203.0.113.10", context.clientIp());
        assertEquals("https", context.scheme());
        assertTrue(context.forwardedUsed());
    }

    @Test
    void fallsBackClosedOnMalformedForwarded() {
        TrustedRequestContextResolver resolver =
                new TrustedRequestContextResolver(TrustedProxyPolicy.fromRules(java.util.List.of("10.0.0.0/8")));
        HttpServletRequest request = baseRequest("10.0.0.5", "http", "internal.local", 8080);
        when(request.getHeader("Forwarded")).thenReturn("for=_hidden;proto=https;host=app.example.test");

        var context = resolver.resolve(request);

        assertEquals("10.0.0.5", context.clientIp());
        assertEquals("http", context.scheme());
        assertFalse(context.forwardedUsed());
    }

    @Test
    void resolvesForwardedChainFromRightToLeft() {
        TrustedRequestContextResolver resolver =
                new TrustedRequestContextResolver(TrustedProxyPolicy.fromRules(java.util.List.of("10.0.0.0/8", "127.0.0.1")));
        HttpServletRequest request = baseRequest("10.0.0.5", "http", "internal.local", 8080);
        when(request.getHeader("Forwarded")).thenReturn(
                "for=198.51.100.10;proto=https;host=app.example.test, for=10.0.0.4, for=127.0.0.1");

        var context = resolver.resolve(request);

        assertEquals("198.51.100.10", context.clientIp());
        assertEquals("https", context.scheme());
        assertTrue(context.forwardedUsed());
    }

    private static HttpServletRequest baseRequest(String remoteAddr, String scheme, String host, int port) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn(remoteAddr);
        when(request.getScheme()).thenReturn(scheme);
        when(request.getServerName()).thenReturn(host);
        when(request.getServerPort()).thenReturn(port);
        return request;
    }
}

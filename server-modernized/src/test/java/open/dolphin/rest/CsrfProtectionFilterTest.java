package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CsrfProtectionFilterTest {

    private CsrfProtectionFilter filter;

    @BeforeEach
    void setUp() {
        filter = new CsrfProtectionFilter();
    }

    @Test
    void validTokenAndValidOriginPass() throws Exception {
        HttpServletRequest request = requestWithToken("POST", "csrf-token");
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getHeader("Origin")).thenReturn("https://example.test");
        when(request.getScheme()).thenReturn("https");
        when(request.getServerName()).thenReturn("example.test");
        when(request.getServerPort()).thenReturn(443);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(response, never()).setStatus(HttpServletResponse.SC_FORBIDDEN);
    }

    @Test
    void validTokenWithCrossSiteOriginIsRejected() throws Exception {
        FailureResult result = executeForbidden("https://evil.test", null, "https", "example.test", 443, null);

        assertThat(result.details()).containsEntry("reason", "csrf_origin_mismatch");
        assertThat(result.details()).doesNotContainKeys("expectedOrigin", "actualOrigin");
        assertThat(result.body()).contains("csrf_origin_mismatch");
        assertThat(result.body()).doesNotContain("evil.test");
        assertThat(result.body()).doesNotContain("example.test");
    }

    @Test
    void validTokenWithSameOriginRefererPasses() throws Exception {
        HttpServletRequest request = requestWithToken("PUT", "csrf-token");
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getHeader("Origin")).thenReturn(null);
        when(request.getHeader("Referer")).thenReturn("https://example.test/charts?runId=1");
        when(request.getScheme()).thenReturn("https");
        when(request.getServerName()).thenReturn("example.test");
        when(request.getServerPort()).thenReturn(443);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    @Test
    void validTokenWithCrossSiteRefererIsRejected() throws Exception {
        FailureResult result = executeForbidden(null, "https://evil.test/charts", "https", "example.test", 443, null);

        assertThat(result.details()).containsEntry("reason", "csrf_origin_mismatch");
        assertThat(result.details()).doesNotContainKeys("expectedOrigin", "actualOrigin");
        assertThat(result.body()).contains("csrf_origin_mismatch");
        assertThat(result.body()).doesNotContain("evil.test");
        assertThat(result.body()).doesNotContain("example.test");
    }

    @Test
    void validTokenWithoutOriginAndRefererIsRejected() throws Exception {
        FailureResult result = executeForbidden(null, null, "https", "example.test", 443, null);

        assertThat(result.details()).containsEntry("reason", "csrf_origin_missing");
        assertThat(result.details()).doesNotContainKeys("expectedOrigin", "actualOrigin");
        assertThat(result.body()).contains("csrf_origin_missing");
        assertThat(result.body()).doesNotContain("example.test");
    }

    @Test
    void invalidTokenRemainsRejected() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        HttpSession session = mock(HttpSession.class);
        when(request.getMethod()).thenReturn("DELETE");
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(any())).thenReturn("csrf-token-1");
        when(request.getHeader(CsrfTokenSupport.CSRF_HEADER_NAME)).thenReturn("csrf-token-2");
        when(request.getHeader("Origin")).thenReturn("https://example.test");
        when(request.getScheme()).thenReturn("https");
        when(request.getServerName()).thenReturn("example.test");
        when(request.getServerPort()).thenReturn(443);
        ByteArrayOutputStream body = stubResponseBody(response);
        when(response.isCommitted()).thenReturn(false);
        Map<String, Object> attrs = captureAttributes(request);

        filter.doFilter(request, response, chain);

        verify(chain, never()).doFilter(request, response);
        verify(response).setStatus(HttpServletResponse.SC_FORBIDDEN);
        assertThat(attrs.get(AbstractResource.ERROR_CODE_ATTRIBUTE)).isEqualTo("csrf_validation_failed");
        assertThat(body.toString(StandardCharsets.UTF_8)).contains("csrf_validation_failed");
    }

    @Test
    void forwardedHeadersDefineExpectedOrigin() throws Exception {
        HttpServletRequest request = requestWithToken("POST", "csrf-token");
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getHeader("Origin")).thenReturn("https://forwarded.example.test");
        when(request.getHeader("Forwarded")).thenReturn("proto=https;host=forwarded.example.test");
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getScheme()).thenReturn("http");
        when(request.getServerName()).thenReturn("internal.local");
        when(request.getServerPort()).thenReturn(8080);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    @Test
    void ignoresForwardedHeadersFromUntrustedRemote() throws Exception {
        FailureResult result = executeForbidden(
                "https://forwarded.example.test",
                null,
                "http",
                "internal.local",
                8080,
                "proto=https;host=forwarded.example.test",
                "198.51.100.20");

        assertThat(result.details()).containsEntry("reason", "csrf_origin_mismatch");
        assertThat(result.details()).doesNotContainKeys("expectedOrigin", "actualOrigin");
        assertThat(result.body()).doesNotContain("forwarded.example.test");
        assertThat(result.body()).doesNotContain("internal.local");
    }

    private FailureResult executeForbidden(
            String origin,
            String referer,
            String scheme,
            String host,
            int port,
            String forwarded,
            String remoteAddr) throws Exception {
        HttpServletRequest request = requestWithToken("POST", "csrf-token");
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getHeader("Origin")).thenReturn(origin);
        when(request.getHeader("Referer")).thenReturn(referer);
        when(request.getHeader("Forwarded")).thenReturn(forwarded);
        when(request.getRemoteAddr()).thenReturn(remoteAddr);
        when(request.getScheme()).thenReturn(scheme);
        when(request.getServerName()).thenReturn(host);
        when(request.getServerPort()).thenReturn(port);
        ByteArrayOutputStream body = stubResponseBody(response);
        when(response.isCommitted()).thenReturn(false);
        Map<String, Object> attrs = captureAttributes(request);

        filter.doFilter(request, response, chain);

        verify(chain, never()).doFilter(request, response);
        verify(response).setStatus(HttpServletResponse.SC_FORBIDDEN);
        @SuppressWarnings("unchecked")
        Map<String, Object> details = (Map<String, Object>) attrs.get(AbstractResource.ERROR_DETAILS_ATTRIBUTE);
        return new FailureResult(details, body.toString(StandardCharsets.UTF_8));
    }

    private FailureResult executeForbidden(
            String origin,
            String referer,
            String scheme,
            String host,
            int port,
            String forwarded) throws Exception {
        return executeForbidden(origin, referer, scheme, host, port, forwarded, "127.0.0.1");
    }

    private HttpServletRequest requestWithToken(String method, String token) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = mock(HttpSession.class);
        when(request.getMethod()).thenReturn(method);
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute(any())).thenReturn(token);
        when(request.getHeader(CsrfTokenSupport.CSRF_HEADER_NAME)).thenReturn(token);
        return request;
    }

    private static Map<String, Object> captureAttributes(HttpServletRequest request) {
        Map<String, Object> attrs = new HashMap<>();
        doAnswer(invocation -> {
            attrs.put(invocation.getArgument(0, String.class), invocation.getArgument(1));
            return null;
        }).when(request).setAttribute(any(String.class), any());
        return attrs;
    }

    private static ByteArrayOutputStream stubResponseBody(HttpServletResponse response) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        when(response.getOutputStream()).thenReturn(new ServletOutputStream() {
            @Override
            public void write(int b) {
                out.write(b);
            }

            @Override
            public boolean isReady() {
                return true;
            }

            @Override
            public void setWriteListener(WriteListener writeListener) {
                // no-op
            }
        });
        return out;
    }

    private record FailureResult(Map<String, Object> details, String body) {
    }
}

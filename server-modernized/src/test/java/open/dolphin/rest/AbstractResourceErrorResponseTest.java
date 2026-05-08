package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import open.dolphin.security.auth.TrustedProxyPolicy;
import open.dolphin.security.auth.TrustedRequestContextResolver;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class AbstractResourceErrorResponseTest {

    @AfterEach
    void tearDown() {
        AbstractResource.setTrustedRequestContextResolverSupplier(null);
    }

    @Test
    void restErrorIncludesRequestIdAndRunIdFromRequestContext() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/admin/access/users");
        when(request.getHeader("X-Request-Id")).thenReturn("req-header-1");
        when(request.getHeader("X-Run-Id")).thenReturn("run-header-1");
        when(request.getHeader("X-Trace-Id")).thenReturn("trace-header-1");
        when(request.getAttribute(LogFilter.REQUEST_ID_ATTRIBUTE)).thenReturn("req-attr-1");
        when(request.getAttribute(LogFilter.RUN_ID_ATTRIBUTE)).thenReturn("run-attr-1");
        when(request.getAttribute(LogFilter.TRACE_ID_ATTRIBUTE)).thenReturn("trace-attr-1");

        WebApplicationException ex = AbstractResource.restError(
                request,
                Response.Status.BAD_REQUEST,
                "invalid_request",
                "validation failed");

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
        assertEquals("trace-attr-1", body.get("traceId"));
        assertEquals("req-attr-1", body.get("requestId"));
        assertEquals("run-attr-1", body.get("runId"));
        assertEquals("validation_error", body.get("errorCategory"));
        assertNotNull(body.get("timestamp"));
    }

    @Test
    void restErrorFallsBackRequestIdToTraceId() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/admin/access/users");
        when(request.getAttribute(LogFilter.TRACE_ID_ATTRIBUTE)).thenReturn("trace-only-1");

        WebApplicationException ex = AbstractResource.restError(
                request,
                Response.Status.INTERNAL_SERVER_ERROR,
                "internal_server_error",
                "backend failed at jdbc://internal.local/private");

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
        assertEquals("trace-only-1", body.get("traceId"));
        assertEquals("trace-only-1", body.get("requestId"));
        assertEquals(500, body.get("status"));
        assertEquals("Internal server error", body.get("message"));
        assertTrue(body.containsKey("timestamp"));
    }

    @Test
    void restErrorResponseDetailsAreSanitizedAndNotMergedIntoTopLevel() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/patient-images");

        WebApplicationException ex = AbstractResource.restError(
                request,
                Response.Status.FORBIDDEN,
                "forbidden",
                "Access denied",
                Map.of(
                        "patientId", "P-001",
                        "facilityId", "F-001",
                        "reason", "csrf_origin_mismatch",
                        "details", Map.of(
                                "patientId", "P-002",
                                "field", "imageId",
                                "internalUrl", "https://internal.example.test")),
                null);

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
        @SuppressWarnings("unchecked")
        Map<String, Object> details = (Map<String, Object>) body.get("details");
        assertNotNull(details);
        assertEquals("csrf_origin_mismatch", details.get("reason"));
        assertEquals("imageId", details.get("field"));
        assertFalse(details.containsKey("patientId"));
        assertFalse(details.containsKey("facilityId"));
        assertFalse(details.containsKey("internalUrl"));
        assertEquals("csrf_origin_mismatch", body.get("reason"));
        assertFalse(body.containsKey("patientId"));
        assertFalse(body.containsKey("facilityId"));
        String rendered = AbstractResource.getSerializeMapper().writeValueAsString(body);
        assertFalse(rendered.contains("P-001"));
        assertFalse(rendered.contains("P-002"));
        assertFalse(rendered.contains("F-001"));
        assertFalse(rendered.contains("internal.example.test"));
    }

    @Test
    void resolveClientIpUsesForwardedForOnlyWhenRemoteAddrIsTrustedProxy() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("10.0.0.5");
        when(request.getHeader("X-Forwarded-For")).thenReturn("198.51.100.7, 10.0.0.5");
        AbstractResource.setTrustedRequestContextResolverSupplier(
                () -> new TrustedRequestContextResolver(TrustedProxyPolicy.fromRules(java.util.List.of("10.0.0.0/8"))));

        assertEquals("198.51.100.7", AbstractResource.resolveClientIp(request));
    }
}

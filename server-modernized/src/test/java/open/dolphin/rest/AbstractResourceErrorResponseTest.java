package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AbstractResourceErrorResponseTest {

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
                "failed");

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
        assertEquals("trace-only-1", body.get("traceId"));
        assertEquals("trace-only-1", body.get("requestId"));
        assertEquals(500, body.get("status"));
        assertTrue(body.containsKey("timestamp"));
    }
}

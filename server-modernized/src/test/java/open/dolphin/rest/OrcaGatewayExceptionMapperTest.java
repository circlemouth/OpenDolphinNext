package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.lang.reflect.Field;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import open.dolphin.orca.OrcaGatewayException;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OrcaGatewayExceptionMapperTest {

    @Test
    void mapperReturnsStandardizedErrorEnvelope() throws Exception {
        OrcaGatewayExceptionMapper mapper = new OrcaGatewayExceptionMapper();
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/orca/official/patient");
        when(request.getAttribute(LogFilter.TRACE_ID_ATTRIBUTE)).thenReturn("trace-orca-1");
        when(request.getAttribute(LogFilter.REQUEST_ID_ATTRIBUTE)).thenReturn("req-orca-1");
        when(request.getAttribute(LogFilter.RUN_ID_ATTRIBUTE)).thenReturn("run-orca-1");

        Field field = OrcaGatewayExceptionMapper.class.getDeclaredField("request");
        field.setAccessible(true);
        field.set(mapper, request);

        Response response = mapper.toResponse(new OrcaGatewayException("timeout"));
        assertEquals(502, response.getStatus());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertEquals("orca_gateway_error", body.get("error"));
        assertEquals("req-orca-1", body.get("requestId"));
        assertEquals("run-orca-1", body.get("runId"));
        assertNotNull(body.get("timestamp"));
    }

    @Test
    void mapperReturns503ForUnavailableTransport() throws Exception {
        OrcaGatewayExceptionMapper mapper = new OrcaGatewayExceptionMapper();
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/orca/official/patient");

        Field field = OrcaGatewayExceptionMapper.class.getDeclaredField("request");
        field.setAccessible(true);
        field.set(mapper, request);

        Response response = mapper.toResponse(new OrcaGatewayException("ORCA transport settings are incomplete"));
        assertEquals(503, response.getStatus());
    }

    @Test
    void mapperSanitizesInvalidUrlMessage() throws Exception {
        OrcaGatewayExceptionMapper mapper = new OrcaGatewayExceptionMapper();
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/orca/official/patient");

        Field field = OrcaGatewayExceptionMapper.class.getDeclaredField("request");
        field.setAccessible(true);
        field.set(mapper, request);

        Response response = mapper.toResponse(new OrcaGatewayException(
                "[invalid_url] Invalid ORCA API URL: https://" + "admin:pass@" + "bad host.example.invalid/secret-prefix"));
        assertEquals(502, response.getStatus());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertEquals("Invalid ORCA API URL", body.get("message"));
        assertFalse(String.valueOf(body.get("message")).contains("bad host.example.invalid"));
        assertFalse(String.valueOf(body.get("message")).contains("admin:pass"));
        String rendered = AbstractResource.getSerializeMapper().writeValueAsString(body);
        assertFalse(rendered.contains("https://" + "admin:pass@" + "bad host.example.invalid/secret-prefix"));
        assertFalse(rendered.contains("bad host.example.invalid"));
        assertFalse(rendered.contains("admin:pass"));
        assertFalse(rendered.contains("secret-prefix"));
    }
}

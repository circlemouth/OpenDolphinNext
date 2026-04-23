package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.Map;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.orca.transport.OrcaConnectionPolicyException;
import org.junit.jupiter.api.Test;

class RestExceptionMapperTest {

    @Test
    void mapsOrcaConnectionPolicyFailuresToSanitized503GatewayEnvelope() throws Exception {
        RestExceptionMapper mapper = mapperWithRequest("/api/orca/official/chart-support/medical-mod-v2");

        Response response = mapper.toResponse(new OrcaConnectionPolicyException(
                OrcaConnectionConfigStore.REASON_CODE_FACILITY_CONFIGURATION_MISSING,
                "ORCA facility configuration is not available"));

        assertEquals(503, response.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertEquals("orca_gateway_error", body.get("error"));
        assertEquals("ORCA facility configuration is not available", body.get("message"));
    }

    @Test
    void sanitizesWrappedOrcaGatewayFailureBeforeReturningGatewayEnvelope() throws Exception {
        RestExceptionMapper mapper = mapperWithRequest("/api/orca/official/chart-support/medical-mod-v2");

        Response response = mapper.toResponse(new RuntimeException("Session layer failure",
                new OrcaGatewayException("[invalid_url] Invalid ORCA API URL: https://"
                        + "userinfo@" + "bad host.example.invalid/private-prefix")));

        assertEquals(502, response.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertEquals("orca_gateway_error", body.get("error"));
        assertEquals("Invalid ORCA API URL", body.get("message"));
        String rendered = AbstractResource.getSerializeMapper().writeValueAsString(body);
        assertFalse(rendered.contains("bad host.example.invalid"));
        assertFalse(rendered.contains("userinfo"));
        assertFalse(rendered.contains("private-prefix"));
    }

    private static RestExceptionMapper mapperWithRequest(String uri) throws Exception {
        RestExceptionMapper mapper = new RestExceptionMapper();
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn(uri);
        when(request.getAttribute(LogFilter.TRACE_ID_ATTRIBUTE)).thenReturn("trace-rest-mapper");
        when(request.getAttribute(LogFilter.REQUEST_ID_ATTRIBUTE)).thenReturn("req-rest-mapper");
        when(request.getAttribute(LogFilter.RUN_ID_ATTRIBUTE)).thenReturn("run-rest-mapper");
        Field field = RestExceptionMapper.class.getDeclaredField("request");
        field.setAccessible(true);
        field.set(mapper, request);
        return mapper;
    }
}

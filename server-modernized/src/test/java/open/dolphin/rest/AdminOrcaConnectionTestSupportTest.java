package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.orca.config.OrcaConnectionConfigRecord;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.transport.OrcaConnectionPolicyException;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AdminOrcaConnectionTestSupportTest {

    private HttpServletRequest request;
    private UserServiceBean userServiceBean;
    private OrcaConnectionConfigStore configStore;
    private RestOrcaTransport restOrcaTransport;

    @BeforeEach
    void setUp() {
        request = mock(HttpServletRequest.class);
        userServiceBean = mock(UserServiceBean.class);
        configStore = mock(OrcaConnectionConfigStore.class);
        restOrcaTransport = mock(RestOrcaTransport.class);
    }

    @Test
    void testConnectionReturnsBadRequestForPolicyViolation() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-ORCA");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);
        OrcaConnectionConfigRecord record = new OrcaConnectionConfigRecord();
        record.setPushUrl("wss://push.example.invalid/ws");
        record.setPushTenantId("tenant-01");
        when(configStore.getSnapshot("FACILITY")).thenReturn(record);
        when(configStore.resolve("FACILITY"))
                .thenThrow(new OrcaConnectionPolicyException("insecure_http_disallowed", "本番環境では ORCA の insecure HTTP は許可されていません。"));

        Response response = new AdminOrcaConnectionTestSupport(
                request,
                configStore,
                restOrcaTransport,
                userServiceBean,
                mock(SessionAuditDispatcher.class))
                .testConnection();

        assertEquals(400, response.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertEquals(Boolean.FALSE, body.get("ok"));
        assertEquals("insecure_http_disallowed", body.get("errorCategory"));
        assertEquals("api_only", body.get("testedScope"));
        assertEquals(Boolean.FALSE, body.get("pushTested"));
        assertEquals(Boolean.TRUE, body.get("pushConfigured"));
        assertEquals(Boolean.TRUE, body.get("pushTenantConfigured"));
    }

    @Test
    void testConnectionSanitizesInvalidUrlFailureInResponseAndAudit() {
        when(request.getHeader("X-Run-Id")).thenReturn("RUN-ORCA");
        when(request.getRemoteUser()).thenReturn("FACILITY:admin");
        when(userServiceBean.isAdmin("FACILITY:admin")).thenReturn(true);
        when(configStore.resolve("FACILITY")).thenReturn(new OrcaConnectionConfigStore.ResolvedOrcaConnection(
                true,
                "https://facility.example.orca",
                "user",
                "pass",
                false,
                null,
                null,
                null));
        when(restOrcaTransport.invoke(
                org.mockito.ArgumentMatchers.eq("FACILITY"),
                org.mockito.ArgumentMatchers.eq(OrcaEndpoint.SYSTEM_MANAGEMENT_LIST),
                org.mockito.ArgumentMatchers.any(OrcaTransportRequest.class)))
                .thenThrow(new OrcaGatewayException(
                        "[invalid_url] Invalid ORCA API URL: https://admin:pass@bad host.example.invalid/api"));
        CapturingAuditDispatcher dispatcher = new CapturingAuditDispatcher();

        Response response = new AdminOrcaConnectionTestSupport(
                request,
                configStore,
                restOrcaTransport,
                userServiceBean,
                dispatcher)
                .testConnection();

        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertEquals(Boolean.FALSE, body.get("ok"));
        assertEquals("config_invalid", body.get("errorCategory"));
        assertEquals("接続先URLが不正です。", body.get("error"));
        assertFalse(String.valueOf(body.get("error")).contains("bad host.example.invalid"));
        assertFalse(String.valueOf(dispatcher.errorMessage).contains("bad host.example.invalid"));
        assertFalse(String.valueOf(dispatcher.errorMessage).contains("admin:pass"));
    }

    private static final class CapturingAuditDispatcher extends SessionAuditDispatcher {
        private AuditEventPayload payload;
        private String errorCode;
        private String errorMessage;

        @Override
        public AuditEventEnvelope record(AuditEventPayload payload, AuditEventEnvelope.Outcome overrideOutcome,
                String errorCode, String errorMessage) {
            this.payload = payload;
            this.errorCode = errorCode;
            this.errorMessage = errorMessage;
            return null;
        }
    }
}

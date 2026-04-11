package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import open.dolphin.orca.config.OrcaConnectionConfigRecord;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.orca.transport.OrcaConnectionPolicyException;
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
}

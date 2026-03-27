package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;

class OrcaApiProxySupportTest {

    @Test
    void defaultsProxyHeaderForwardingToDisabled() {
        ServerConfigurationResolver resolver = new ServerConfigurationResolver();

        assertFalse(OrcaApiProxySupport.isForwardXOrcaHeadersEnabled(resolver));
        assertFalse(OrcaApiProxySupport.isApiResultMessageHeaderEnabled(resolver));
    }

    @Test
    void enablesProxyHeaderForwardingOnlyWhenExplicitlyConfiguredTrue() {
        ServerConfigurationResolver resolver = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_PROXY_FORWARD_X_ORCA_HEADERS, "true",
                ServerConfigurationResolver.KEY_ORCA_PROXY_FORWARD_API_RESULT_MESSAGE_HEADER, "true");

        assertTrue(OrcaApiProxySupport.isForwardXOrcaHeadersEnabled(resolver));
        assertTrue(OrcaApiProxySupport.isApiResultMessageHeaderEnabled(resolver));
    }

    @Test
    void disablesProxyHeaderForwardingWhenConfiguredFalse() {
        ServerConfigurationResolver resolver = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_PROXY_FORWARD_X_ORCA_HEADERS, "false",
                ServerConfigurationResolver.KEY_ORCA_PROXY_FORWARD_API_RESULT_MESSAGE_HEADER, "false");

        assertFalse(OrcaApiProxySupport.isForwardXOrcaHeadersEnabled(resolver));
        assertFalse(OrcaApiProxySupport.isApiResultMessageHeaderEnabled(resolver));
    }

    @Test
    void buildProxyResponseDoesNotForwardHeadersWhenDisabledByDefault() {
        OrcaTransportResult result = new OrcaTransportResult(
                "https://orca.example.test",
                "POST",
                200,
                "<xml/>",
                "application/xml",
                Map.of(
                        "X-Orca-Trace", List.of("trace-1"),
                        "X-Orca-Api-Result-Message", List.of("ok"),
                        "X-Other", List.of("other")));

        Response response = OrcaApiProxySupport.buildProxyResponse(result, "run-123");

        assertNull(response.getHeaderString("X-Orca-Trace"));
        assertNull(response.getHeaderString("X-Orca-Api-Result-Message"));
        assertNull(response.getHeaderString("X-Other"));
        assertTrue(response.getHeaderString("X-Run-Id").contains("run-123"));
    }
}

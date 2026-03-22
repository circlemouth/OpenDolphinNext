package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;

class OrcaApiProxySupportTest {

    @Test
    void defaultsProxyHeaderForwardingToEnabled() {
        ServerConfigurationResolver resolver = new ServerConfigurationResolver();

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
}

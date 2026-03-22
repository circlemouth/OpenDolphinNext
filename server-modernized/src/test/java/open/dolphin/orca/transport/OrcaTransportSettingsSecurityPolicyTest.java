package open.dolphin.orca.transport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import org.junit.jupiter.api.Test;

class OrcaTransportSettingsSecurityPolicyTest {

    @Test
    void fromAdminConfigRejectsInsecureWeborcaInProduction() {
        OrcaConnectionPolicyException ex = assertThrows(
                OrcaConnectionPolicyException.class,
                () -> OrcaTransportSecurityPolicy.validateUri(URI.create("http://weborca.example.test"), true, "production", false)
        );

        assertEquals("weborca_requires_https", ex.getErrorCategory());
        assertTrue(ex.getMessage().contains("HTTPS"));
    }

    @Test
    void fromAdminConfigRejectsInsecureHttpInProductionWhenFlagDisabled() {
        OrcaConnectionPolicyException ex = assertThrows(
                OrcaConnectionPolicyException.class,
                () -> OrcaTransportSecurityPolicy.validateUri(URI.create("http://192.168.10.20:8000"), false, "production", false)
        );

        assertEquals("insecure_http_disallowed", ex.getErrorCategory());
        assertTrue(ex.getMessage().contains("HTTP"));
    }

    @Test
    void fromAdminConfigAllowsInsecurePrivateHttpOnlyWhenFlagEnabled() {
        OrcaTransportSecurityPolicy.validateUri(URI.create("http://192.168.10.20:8000"), false, "production", true);
    }

    @Test
    void fromAdminConfigRejectsInsecurePublicHttpEvenWhenFlagEnabled() {
        OrcaConnectionPolicyException ex = assertThrows(
                OrcaConnectionPolicyException.class,
                () -> OrcaTransportSecurityPolicy.validateUri(URI.create("http://203.0.113.10:8000"), false, "production", true)
        );

        assertEquals("insecure_http_target_not_allowed", ex.getErrorCategory());
        assertTrue(ex.getMessage().contains("private range"));
    }
}

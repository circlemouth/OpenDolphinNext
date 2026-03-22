package open.dolphin.mbean;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.testsupport.MicroProfileConfigTestSupport;
import org.junit.jupiter.api.Test;

class ServletStartupSecurityGuardTest {

    @Test
    void productionLikeEnvironmentRejectsLegacyOrcaMasterCredential() throws Exception {
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "production",
                ServletStartup.ORCA_MASTER_BASIC_PASSWORD_KEY, "legacy-secret")) {
            IllegalStateException ex = assertThrows(IllegalStateException.class, ServletStartup::enforceStartupSecurityGuards);

            assertTrue(ex.getMessage().contains(ServletStartup.ORCA_MASTER_BASIC_PASSWORD_KEY));
        }
    }

    @Test
    void nonProductionEnvironmentSkipsGuards() throws Exception {
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "local",
                ServletStartup.ORCA_MASTER_BASIC_PASSWORD_KEY, "legacy-secret")) {
            assertDoesNotThrow(ServletStartup::enforceStartupSecurityGuards);
        }
    }
}

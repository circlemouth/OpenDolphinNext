package open.dolphin.mbean;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import open.dolphin.runtime.RuntimeConfigurationSupport;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.testsupport.MicroProfileConfigTestSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ServletStartupSecurityGuardTest {

    @AfterEach
    void tearDown() {
        System.clearProperty(RuntimeConfigurationSupport.PROP_ENVIRONMENT);
        System.clearProperty(ServletStartup.ORCA_MASTER_BASIC_USER_KEY);
        System.clearProperty(ServletStartup.ORCA_MASTER_BASIC_PASSWORD_KEY);
    }

    @Test
    void productionLikeEnvironmentRejectsLegacyOrcaMasterCredential() throws Exception {
        System.setProperty(ServletStartup.ORCA_MASTER_BASIC_PASSWORD_KEY, "legacy-secret");
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "production")) {
            IllegalStateException ex = assertThrows(IllegalStateException.class, ServletStartup::enforceStartupSecurityGuards);

            assertTrue(ex.getMessage().contains(ServletStartup.ORCA_MASTER_BASIC_PASSWORD_KEY));
        }
    }

    @Test
    void nonProductionEnvironmentSkipsGuards() throws Exception {
        System.setProperty(ServletStartup.ORCA_MASTER_BASIC_PASSWORD_KEY, "legacy-secret");
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "local")) {
            assertDoesNotThrow(ServletStartup::enforceStartupSecurityGuards);
        }
    }
}

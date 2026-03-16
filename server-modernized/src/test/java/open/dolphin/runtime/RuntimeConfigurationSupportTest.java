package open.dolphin.runtime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class RuntimeConfigurationSupportTest {

    @AfterEach
    void tearDown() {
        System.clearProperty(RuntimeConfigurationSupport.PROP_ENVIRONMENT);
        System.clearProperty(RuntimeConfigurationSupport.PROP_TIMEZONE);
        System.clearProperty(RuntimeConfigurationSupport.PROP_SERVER_DATA_DIR);
    }

    @Test
    void resolveEnvironmentIgnoresFrontendSpecificKeys() {
        assertNull(RuntimeConfigurationSupport.resolveEnvironment());
    }

    @Test
    void parseBooleanFlagSupportsCommonVariants() {
        assertTrue(RuntimeConfigurationSupport.parseBooleanFlag("true"));
        assertTrue(RuntimeConfigurationSupport.parseBooleanFlag(" On "));
        assertFalse(RuntimeConfigurationSupport.parseBooleanFlag("0"));
    }

    @Test
    void resolveTimezoneFallsBackToDefaultWhenInvalid() {
        System.setProperty(RuntimeConfigurationSupport.PROP_TIMEZONE, "Invalid/Timezone");
        assertEquals(RuntimeConfigurationSupport.DEFAULT_TIMEZONE, RuntimeConfigurationSupport.resolveTimezoneId());
    }
}

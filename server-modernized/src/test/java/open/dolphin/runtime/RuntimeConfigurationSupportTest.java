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
    void resolveBooleanFlagFallsBackWhenUnset() {
        assertFalse(RuntimeConfigurationSupport.resolveBooleanFlag("missing.property", "MISSING_ENV", false));
        assertTrue(RuntimeConfigurationSupport.resolveBooleanFlag("missing.property", "MISSING_ENV", true));
    }

    @Test
    void resolvePositiveNumbersUseSystemPropertyFirst() {
        System.setProperty("runtime.test.int", "7");
        System.setProperty("runtime.test.long", "11");

        assertEquals(7, RuntimeConfigurationSupport.resolvePositiveInt("runtime.test.int", "MISSING_ENV", 3));
        assertEquals(11L, RuntimeConfigurationSupport.resolvePositiveLong("runtime.test.long", "MISSING_ENV", 5L));
    }

    @Test
    void resolveFacilityIdUsesTypedProperty() {
        System.setProperty(RuntimeConfigurationSupport.PROP_FACILITY_ID, "F001");

        assertEquals("F001", RuntimeConfigurationSupport.resolveFacilityId("MISSING_ENV"));
    }

    @Test
    void resolveTimezoneFallsBackToDefaultWhenInvalid() {
        System.setProperty(RuntimeConfigurationSupport.PROP_TIMEZONE, "Invalid/Timezone");
        assertEquals(RuntimeConfigurationSupport.DEFAULT_TIMEZONE, RuntimeConfigurationSupport.resolveTimezoneId());
    }
}

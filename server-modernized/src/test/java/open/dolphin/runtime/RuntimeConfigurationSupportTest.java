package open.dolphin.runtime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class RuntimeConfigurationSupportTest {

    @Test
    void isProductionLikeEnvironmentMatchesKnownPrefixes() {
        assertTrue(RuntimeConfigurationSupport.isProductionLikeEnvironment("production"));
        assertTrue(RuntimeConfigurationSupport.isProductionLikeEnvironment("stg-blue"));
        assertFalse(RuntimeConfigurationSupport.isProductionLikeEnvironment("local"));
        assertFalse(RuntimeConfigurationSupport.isProductionLikeEnvironment(null));
    }

    @Test
    void parseBooleanFlagSupportsCommonVariants() {
        assertTrue(RuntimeConfigurationSupport.parseBooleanFlag("true"));
        assertTrue(RuntimeConfigurationSupport.parseBooleanFlag(" On "));
        assertFalse(RuntimeConfigurationSupport.parseBooleanFlag("0"));
        assertNull(RuntimeConfigurationSupport.parseBooleanFlag("maybe"));
    }

    @Test
    void firstNonBlankReturnsTrimmedValue() {
        assertEquals("value", RuntimeConfigurationSupport.firstNonBlank(null, "  ", " value "));
        assertNull(RuntimeConfigurationSupport.firstNonBlank(null, "", "  "));
    }
}

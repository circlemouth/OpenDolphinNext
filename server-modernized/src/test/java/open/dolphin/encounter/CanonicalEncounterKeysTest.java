package open.dolphin.encounter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class CanonicalEncounterKeysTest {

    @Test
    void scheduleKeyAndEncounterKeyUseFacilityPrefixedCanonicalForm() {
        assertEquals("F001:A100", CanonicalEncounterKeys.scheduleKey("F001", "A100"));
        assertEquals("F001:E100", CanonicalEncounterKeys.encounterKey("F001", "E100"));
    }

    @Test
    void optionalHelpersTrimWhitespaceAndFailClosedOnBlankValues() {
        assertEquals("F001:A100", CanonicalEncounterKeys.optionalScheduleKey(" F001 ", " A100 "));
        assertEquals("F001:E100", CanonicalEncounterKeys.optionalEncounterKey(" F001 ", " E100 "));
        assertNull(CanonicalEncounterKeys.optionalScheduleKey("F001", "   "));
        assertNull(CanonicalEncounterKeys.optionalEncounterKey("   ", "E100"));
    }

    @Test
    void requiredHelpersRejectMissingSources() {
        assertThrows(IllegalArgumentException.class, () -> CanonicalEncounterKeys.scheduleKey(null, "A100"));
        assertThrows(IllegalArgumentException.class, () -> CanonicalEncounterKeys.encounterKey("F001", null));
    }
}

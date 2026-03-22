package open.orca.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class OrcaLegacyRequestSupportTest {

    @Test
    void normalizeOrcaDateConvertsIsoDateToDigits() {
        assertEquals("20260322", OrcaLegacyRequestSupport.normalizeOrcaDate("2026-03-22"));
        assertEquals("20260322", OrcaLegacyRequestSupport.resolveEffectiveDate("2026-03-22"));
    }

    @Test
    void toDolphinDateReturnsNullForMalformedInput() {
        assertNull(OrcaLegacyRequestSupport.toDolphinDate("bad-date"));
        assertTrue(OrcaLegacyRequestSupport.parseBooleanOrDefault("true", false));
        assertFalse(OrcaLegacyRequestSupport.parseBooleanOrDefault("", false));
    }
}

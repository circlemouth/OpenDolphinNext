package open.orca.rest;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import org.junit.jupiter.api.Test;

class OrcaMasterRequestSupportTest {

    @Test
    void getFirstValue_skipsBlankValuesAndFallsBackToNextKey() {
        MultivaluedMap<String, String> params = new MultivaluedHashMap<>();
        params.add("keyword", " ");
        params.add("name", "ゲンタ");

        assertEquals("ゲンタ", OrcaMasterRequestSupport.getFirstValue(params, "keyword", "name"));
    }

    @Test
    void normalizeEffectiveDate_stripsNonDigitsWhenEightDigitsRemain() {
        assertEquals("20260401", OrcaMasterRequestSupport.normalizeEffectiveDate("2026-04-01"));
        assertEquals("2026/04", OrcaMasterRequestSupport.normalizeEffectiveDate("2026/04"));
    }

    @Test
    void normalizeDrugSearchMethod_acceptsOnlySupportedModes() {
        assertEquals("prefix", OrcaMasterRequestSupport.normalizeDrugSearchMethod("PREFIX"));
        assertEquals("partial", OrcaMasterRequestSupport.normalizeDrugSearchMethod("partial"));
        assertNull(OrcaMasterRequestSupport.normalizeDrugSearchMethod("suffix"));
    }

    @Test
    void shouldIncludeTotalCount_acceptsExplicitTruthyValues() {
        MultivaluedMap<String, String> yes = new MultivaluedHashMap<>();
        yes.add("includeTotalCount", "yes");
        assertTrue(OrcaMasterRequestSupport.shouldIncludeTotalCount(yes));

        MultivaluedMap<String, String> no = new MultivaluedHashMap<>();
        no.add("includeTotalCount", "false");
        assertFalse(OrcaMasterRequestSupport.shouldIncludeTotalCount(no));
    }

    @Test
    void parseNullableDouble_andNormalizeTensuVersion_areStable() {
        assertEquals(12.5d, OrcaMasterRequestSupport.parseNullableDouble("12.5"));
        assertNull(OrcaMasterRequestSupport.parseNullableDouble("abc"));
        assertEquals("202604", OrcaMasterRequestSupport.normalizeTensuVersion("2026-04"));
        assertEquals("202604", OrcaMasterRequestSupport.normalizeTensuVersion("202604"));
    }
}

package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Date;
import open.dolphin.infomodel.IInfoModel;
import org.junit.jupiter.api.Test;

class OrcaOrderBundleRequestSupportTest {

    @Test
    void normalizeEntityQueryMapsLegacyAlias() {
        assertEquals(IInfoModel.ENTITY_LABO_TEST, OrcaOrderBundleRequestSupport.normalizeEntityQuery("laboTest"));
        assertNull(OrcaOrderBundleRequestSupport.normalizeEntityQuery(" "));
    }

    @Test
    void normalizeOrcaDateOrTodayPrefersEightDigits() {
        assertEquals("20250321", OrcaOrderBundleRequestSupport.normalizeOrcaDateOrToday("2025-03-21"));
        assertEquals("20250321", OrcaOrderBundleRequestSupport.normalizeOrcaDateOrToday("20250321"));
    }

    @Test
    void trimHelpersCollapseBlankAndDecimalSuffix() {
        assertNull(OrcaOrderBundleRequestSupport.trimToNull(" "));
        assertEquals("3", OrcaOrderBundleRequestSupport.trimNumeric("3.0"));
        assertEquals("3.5", OrcaOrderBundleRequestSupport.trimNumeric("3.5"));
    }

    @Test
    void dateHelpersParseAndFormatIsoValues() {
        Date parsed = OrcaOrderBundleRequestSupport.parseStrictIsoDate("2025-03-21");

        assertNotNull(parsed);
        assertEquals("2025-03-21", OrcaOrderBundleRequestSupport.formatDate(parsed));
        assertNotNull(OrcaOrderBundleRequestSupport.parseDate("2025-03-21", new Date(0L)));
    }

    @Test
    void entityAndOperationValidatorsRejectUnsupportedValues() {
        assertTrue(OrcaOrderBundleRequestSupport.isValidEntity(IInfoModel.ENTITY_MED_ORDER));
        assertFalse(OrcaOrderBundleRequestSupport.isValidEntity("unknown"));
        assertTrue(OrcaOrderBundleRequestSupport.isSupportedOperation("create"));
        assertFalse(OrcaOrderBundleRequestSupport.isSupportedOperation("patch"));
        assertTrue(OrcaOrderBundleRequestSupport.hasText("value"));
        assertFalse(OrcaOrderBundleRequestSupport.hasText(" "));
    }
}

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
        assertEquals("testOrder", OrcaOrderBundleRequestSupport.normalizeEntityQuery("laboTest"));
        assertEquals("treatmentOrder", OrcaOrderBundleRequestSupport.normalizeEntityQuery(IInfoModel.ENTITY_GENERAL_ORDER));
        assertNull(OrcaOrderBundleRequestSupport.normalizeEntityQuery(" "));
    }

    @Test
    void entitiesMatchUsesCanonicalAlias() {
        assertTrue(OrcaOrderBundleRequestSupport.entitiesMatch("testOrder", IInfoModel.ENTITY_LABO_TEST));
        assertTrue(OrcaOrderBundleRequestSupport.entitiesMatch("treatmentOrder", IInfoModel.ENTITY_GENERAL_ORDER));
        assertTrue(OrcaOrderBundleRequestSupport.entitiesMatch("treatmentOrder", IInfoModel.ENTITY_TREATMENT));
        assertFalse(OrcaOrderBundleRequestSupport.entitiesMatch("testOrder", IInfoModel.ENTITY_TREATMENT));
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
        assertTrue(OrcaOrderBundleRequestSupport.isValidEntity("laboTest"));
        assertFalse(OrcaOrderBundleRequestSupport.isValidEntity("unknown"));
        assertTrue(OrcaOrderBundleRequestSupport.isSupportedOperation("create"));
        assertFalse(OrcaOrderBundleRequestSupport.isSupportedOperation("patch"));
        assertTrue(OrcaOrderBundleRequestSupport.hasText("value"));
        assertFalse(OrcaOrderBundleRequestSupport.hasText(" "));
    }

    @Test
    void supportsBodyPartFieldIsLimitedToBodyPartAwareEntities() {
        assertTrue(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_TREATMENT));
        assertTrue(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_RADIOLOGY_ORDER));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField("testOrder"));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_BACTERIA_ORDER));
    }
}

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
        assertTrue(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_RADIOLOGY_ORDER));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_TREATMENT));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_OTHER_ORDER));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField("testOrder"));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_PHYSIOLOGY_ORDER));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_BACTERIA_ORDER));
    }

    @Test
    void isCompatibleClassCodeUsesExactAllowlists() {
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INJECTION_ORDER, "310"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INJECTION_ORDER, "320"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INJECTION_ORDER, "350"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INJECTION_ORDER, "335"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INJECTION_ORDER, "332"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INJECTION_ORDER, "352"));

        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "110"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "114"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "120"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "124"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "125"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "126"));

        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "130"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "132"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "133"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "140"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "141"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "142"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "143"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "148"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "149"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "131"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "144"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "145"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "146"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "147"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "150"));
    }

    @Test
    void resolveCanonicalClassNameUsesExactChargeVocabulary() {
        assertEquals(
                "再診",
                OrcaOrderBundleRequestSupport.resolveCanonicalClassName(
                        IInfoModel.ENTITY_BASE_CHARGE_ORDER,
                        "120",
                        "bundleFallback"));
        assertEquals(
                "在宅料",
                OrcaOrderBundleRequestSupport.resolveCanonicalClassName(
                        IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER,
                        "140",
                        "bundleFallback"));
    }

    @Test
    void injectionAdminCodeHelpersTreatAdminCodeAsLocalOnlyMetadata() {
        assertTrue(OrcaOrderBundleRequestSupport.isSendableUsageCode("4101"));
        assertTrue(OrcaOrderBundleRequestSupport.isSendableInjectionAdminCode("001000"));
        assertFalse(OrcaOrderBundleRequestSupport.isSendableInjectionAdminCode("Y100"));
        assertFalse(OrcaOrderBundleRequestSupport.isSendableInjectionAdminCode("410"));
        assertFalse(OrcaOrderBundleRequestSupport.isSendableInjectionAdminCode(" "));
    }

    @Test
    void requiresSendableMainRowExcludesLocalOnlyEntities() {
        assertFalse(OrcaOrderBundleRequestSupport.requiresSendableMainRow(IInfoModel.ENTITY_MED_ORDER));
        assertFalse(OrcaOrderBundleRequestSupport.requiresSendableMainRow(IInfoModel.ENTITY_OTHER_ORDER));
        assertFalse(OrcaOrderBundleRequestSupport.requiresSendableMainRow(IInfoModel.ENTITY_PHYSIOLOGY_ORDER));
        assertFalse(OrcaOrderBundleRequestSupport.requiresSendableMainRow(IInfoModel.ENTITY_BACTERIA_ORDER));
        assertTrue(OrcaOrderBundleRequestSupport.requiresSendableMainRow(IInfoModel.ENTITY_INJECTION_ORDER));
        assertTrue(OrcaOrderBundleRequestSupport.requiresSendableMainRow(IInfoModel.ENTITY_TREATMENT));
    }

    @Test
    void isCompatibleClassCodeDoesNotApplyOutboundAllowlistToOtherOrderLocalSave() {
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_OTHER_ORDER, "800"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_OTHER_ORDER, "890"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_OTHER_ORDER, "700"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_OTHER_ORDER, "400"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_OTHER_ORDER, "8A0"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_OTHER_ORDER, "891"));
    }

    @Test
    void isCompatibleClassCodeUsesExactRadiologyAllowlist() {
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_RADIOLOGY_ORDER, "700"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_RADIOLOGY_ORDER, "731"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_RADIOLOGY_ORDER, "732"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_RADIOLOGY_ORDER, "710"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_RADIOLOGY_ORDER, "724"));
    }

    @Test
    void otherOrderHelpersAllowLocalOnlyCodeShape() {
        assertTrue(OrcaOrderBundleRequestSupport.isValidOtherOrderCode("180000210"));
        assertTrue(OrcaOrderBundleRequestSupport.isValidOtherOrderCode("800000001"));
        assertTrue(OrcaOrderBundleRequestSupport.isValidOtherOrderCode("81234567"));
        assertTrue(OrcaOrderBundleRequestSupport.isValidOtherOrderCode("18ABC0210"));
    }
}

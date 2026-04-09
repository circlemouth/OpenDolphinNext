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
    void supportsBodyPartFieldIsLimitedToRadiologyClass700() {
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_TREATMENT, "400"));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_RADIOLOGY_ORDER));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_RADIOLOGY_ORDER, null));
        assertTrue(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_RADIOLOGY_ORDER, "700"));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_RADIOLOGY_ORDER, "701"));
        assertFalse(OrcaOrderBundleRequestSupport.isValidCodeForRowRole(
                IInfoModel.ENTITY_RADIOLOGY_ORDER,
                null,
                OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART,
                "002001"));
        assertTrue(OrcaOrderBundleRequestSupport.isValidCodeForRowRole(
                IInfoModel.ENTITY_RADIOLOGY_ORDER,
                "700",
                OrcaOrderBundleRequestSupport.ROW_ROLE_BODY_PART,
                "002001"));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_OTHER_ORDER, null));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField("testOrder", null));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_PHYSIOLOGY_ORDER, null));
        assertFalse(OrcaOrderBundleRequestSupport.supportsBodyPartField(IInfoModel.ENTITY_BACTERIA_ORDER, null));
    }

    @Test
    void isCompatibleClassCodeUsesStrictChargeAllowlists() {
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INJECTION_ORDER, "310"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INJECTION_ORDER, "320"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INJECTION_ORDER, "399"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INJECTION_ORDER, null));

        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "110"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "124"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "109"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "125"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "126"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, null));

        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "130"));
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "149"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "129"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "150"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "151"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, null));
    }

    @Test
    void resolveCatalogClassNameUsesCatalogVocabulary() {
        assertEquals(
                "基本診療料",
                OrcaOrderBundleRequestSupport.resolveCatalogClassName(
                        IInfoModel.ENTITY_BASE_CHARGE_ORDER,
                        "120"));
        assertEquals(
                "医学管理等",
                OrcaOrderBundleRequestSupport.resolveCatalogClassName(
                        IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER,
                        "140"));
        assertEquals(
                "画像診断",
                OrcaOrderBundleRequestSupport.resolveCatalogClassName(
                        IInfoModel.ENTITY_RADIOLOGY_ORDER,
                        "701"));
        assertNull(OrcaOrderBundleRequestSupport.resolveCatalogClassName(IInfoModel.ENTITY_BASE_CHARGE_ORDER, null));
        assertNull(OrcaOrderBundleRequestSupport.resolveCatalogClassName(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "701"));
        assertNull(OrcaOrderBundleRequestSupport.resolveCatalogClassName(IInfoModel.ENTITY_RADIOLOGY_ORDER, null));
    }

    @Test
    void injectionAdminCodeHelpersFailClosedOnNonNumericCodes() {
        assertTrue(OrcaOrderBundleRequestSupport.isSendableUsageCode("4101"));
        assertTrue(OrcaOrderBundleRequestSupport.isSendableUsageCode("001000"));
        assertFalse(OrcaOrderBundleRequestSupport.isSendableUsageCode("Y100"));
        assertFalse(OrcaOrderBundleRequestSupport.isSendableUsageCode("410"));
        assertFalse(OrcaOrderBundleRequestSupport.isSendableUsageCode(" "));
    }

    @Test
    void requiresSendableMainRowIncludesInjectionButNotMedOrder() {
        assertFalse(OrcaOrderBundleRequestSupport.requiresSendableMainRow(IInfoModel.ENTITY_MED_ORDER));
        assertTrue(OrcaOrderBundleRequestSupport.requiresSendableMainRow(IInfoModel.ENTITY_INJECTION_ORDER));
        assertTrue(OrcaOrderBundleRequestSupport.requiresSendableMainRow(IInfoModel.ENTITY_TREATMENT));
        assertFalse(OrcaMedicalClassCatalog.requiresSendableMainRow(IInfoModel.ENTITY_SURGERY_ORDER, "501"));
        assertFalse(OrcaMedicalClassCatalog.requiresSendableMainRow(IInfoModel.ENTITY_SURGERY_ORDER, "502"));
        assertTrue(OrcaMedicalClassCatalog.requiresSendableMainRow(IInfoModel.ENTITY_SURGERY_ORDER, "500"));
    }

    @Test
    void otherOrderOnlyAcceptsNullClassCode() {
        assertTrue(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_OTHER_ORDER, null));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_OTHER_ORDER, "800"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_OTHER_ORDER, "700"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_OTHER_ORDER, "400"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_OTHER_ORDER, "8A0"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_OTHER_ORDER, "891"));
    }

    @Test
    void exactClassEntitiesFailClosedWhenClassCodeIsBlank() {
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_MED_ORDER, null));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_TREATMENT, null));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_SURGERY_ORDER, null));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode("testOrder", null));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_PHYSIOLOGY_ORDER, null));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_BACTERIA_ORDER, null));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode(IInfoModel.ENTITY_RADIOLOGY_ORDER, null));
    }

    @Test
    void otherOrderHelpersRequireExplicitLocalOnlyCodeShape() {
        assertTrue(OrcaOrderBundleRequestSupport.isValidOtherOrderCode("LOCAL_OTHER:CERTIFICATE_FEE"));
        assertTrue(OrcaOrderBundleRequestSupport.isValidOtherOrderCode("LOCAL_OTHER:LOCAL-NOTE.01"));
        assertTrue(OrcaOrderBundleRequestSupport.isValidCodeForRowRole(IInfoModel.ENTITY_OTHER_ORDER, OrcaOrderBundleRequestSupport.ROW_ROLE_MAIN, "LOCAL_OTHER:CERTIFICATE_FEE"));
        assertTrue(OrcaOrderBundleRequestSupport.isValidCodeForRowRole(IInfoModel.ENTITY_OTHER_ORDER, OrcaOrderBundleRequestSupport.ROW_ROLE_COMMENT, "LOCAL_OTHER:LOCAL-NOTE.01"));
        assertFalse(OrcaOrderBundleRequestSupport.isValidCodeForRowRole(IInfoModel.ENTITY_OTHER_ORDER, OrcaOrderBundleRequestSupport.ROW_ROLE_MAIN, "180000210"));
        assertFalse(OrcaOrderBundleRequestSupport.isValidCodeForRowRole(IInfoModel.ENTITY_OTHER_ORDER, OrcaOrderBundleRequestSupport.ROW_ROLE_COMMENT, "0085001"));
        assertFalse(OrcaOrderBundleRequestSupport.isValidOtherOrderCode("LOCAL-001"));
        assertFalse(OrcaOrderBundleRequestSupport.isValidOtherOrderCode("180000210"));
        assertFalse(OrcaOrderBundleRequestSupport.isValidOtherOrderCode("800000001"));
        assertFalse(OrcaOrderBundleRequestSupport.isValidOtherOrderCode("002001"));
        assertFalse(OrcaOrderBundleRequestSupport.isValidOtherOrderCode("0085001"));
        assertFalse(OrcaOrderBundleRequestSupport.isValidOtherOrderCode("81234567"));
        assertFalse(OrcaOrderBundleRequestSupport.isValidOtherOrderCode("18ABC0210"));
    }

    @Test
    void testOrderClassCodeHelpersStayExactFailClosed() {
        assertTrue(OrcaOrderBundleRequestSupport.isExactTestOrderClassCode("600"));
        assertTrue(OrcaOrderBundleRequestSupport.isExactTestOrderClassCode("610"));
        assertFalse(OrcaOrderBundleRequestSupport.isExactTestOrderClassCode("611"));
        assertFalse(OrcaOrderBundleRequestSupport.isExactTestOrderClassCode("699"));
        assertTrue(OrcaOrderBundleRequestSupport.isRejectedTestOrderClassCode("640"));
        assertTrue(OrcaOrderBundleRequestSupport.isRejectedTestOrderClassCode("643"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode("testOrder", "640"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode("testOrder", "643"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode("testOrder", "611"));
        assertFalse(OrcaOrderBundleRequestSupport.isCompatibleClassCode("testOrder", "699"));
    }
}

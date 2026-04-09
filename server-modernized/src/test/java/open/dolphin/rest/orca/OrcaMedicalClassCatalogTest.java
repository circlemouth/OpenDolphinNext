package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import open.dolphin.infomodel.ClaimConst;
import open.dolphin.infomodel.IInfoModel;
import org.junit.jupiter.api.Test;

class OrcaMedicalClassCatalogTest {

    @Test
    void resolveChargeClassMetaRequiresExplicitValidClassCode() {
        assertNull(OrcaMedicalClassCatalog.resolveChargeClassMeta(IInfoModel.ENTITY_BASE_CHARGE_ORDER, null, "110"));
        assertNull(OrcaMedicalClassCatalog.resolveChargeClassMeta(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "110", "999"));

        OrcaMedicalClassCatalog.ChargeClassMeta meta =
                OrcaMedicalClassCatalog.resolveChargeClassMeta(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "110", "110");

        assertNotNull(meta);
        assertEquals("110", meta.classCode());
        assertEquals(ClaimConst.CLASS_CODE_ID, meta.classCodeSystem());
        assertEquals("基本診療料", meta.className());
    }

    @Test
    void resolveCatalogClassCodeAndNameFailClosedWithoutExplicitClassCode() {
        assertNull(OrcaMedicalClassCatalog.resolveCatalogClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, null));
        assertNull(OrcaMedicalClassCatalog.resolveCatalogClassName(IInfoModel.ENTITY_BASE_CHARGE_ORDER, null));
        assertNull(OrcaMedicalClassCatalog.resolveCatalogClassCode(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "701"));
        assertNull(OrcaMedicalClassCatalog.resolveCatalogClassName(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "701"));
    }

    @Test
    void supportsBodyPartFieldIsExplicitClassCodeOnly() {
        assertFalse(OrcaMedicalClassCatalog.supportsBodyPartField(IInfoModel.ENTITY_RADIOLOGY_ORDER, null));
        assertFalse(OrcaMedicalClassCatalog.supportsBodyPartField(IInfoModel.ENTITY_RADIOLOGY_ORDER, "701"));
        assertTrue(OrcaMedicalClassCatalog.supportsBodyPartField(IInfoModel.ENTITY_RADIOLOGY_ORDER, "700"));
    }
}

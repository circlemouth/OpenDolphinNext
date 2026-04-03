package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import open.dolphin.infomodel.IInfoModel;
import org.junit.jupiter.api.Test;

class OrcaOrderBundle600SubtypeSupportTest {

    @Test
    void resolveSubtypeUsesEntityDefaultAndStoredStampMemo() {
        assertEquals("specimen", OrcaOrderBundle600SubtypeSupport.resolveSubtype("testOrder", null, null));
        assertEquals("physiology", OrcaOrderBundle600SubtypeSupport.resolveSubtype(
                IInfoModel.ENTITY_PHYSIOLOGY_ORDER,
                null,
                null));
        assertEquals("culture", OrcaOrderBundle600SubtypeSupport.resolveSubtype(
                IInfoModel.ENTITY_BACTERIA_ORDER,
                null,
                "[orca-order-subtype:culture]"));
    }

    @Test
    void validateSubtypeRejectsCrossEntityValues() {
        assertTrue(OrcaOrderBundle600SubtypeSupport.isValidSubtype("testOrder", "specimen"));
        assertTrue(OrcaOrderBundle600SubtypeSupport.isValidSubtype(IInfoModel.ENTITY_BACTERIA_ORDER, "culture"));
        assertFalse(OrcaOrderBundle600SubtypeSupport.isValidSubtype("testOrder", "culture"));
        assertFalse(OrcaOrderBundle600SubtypeSupport.isValidSubtype(IInfoModel.ENTITY_BACTERIA_ORDER, "specimen"));
    }

    @Test
    void updateStampMemoPersistsOnlyNonDefaultSubtype() {
        assertNull(OrcaOrderBundle600SubtypeSupport.updateStampMemo(null, "testOrder", "specimen"));
        assertEquals(
                "[orca-order-subtype:culture]",
                OrcaOrderBundle600SubtypeSupport.updateStampMemo(null, IInfoModel.ENTITY_BACTERIA_ORDER, "culture"));
        assertEquals(
                "memo [orca-order-subtype:sensitivity]",
                OrcaOrderBundle600SubtypeSupport.updateStampMemo(
                        "memo [orca-order-subtype:culture]",
                        IInfoModel.ENTITY_BACTERIA_ORDER,
                        "sensitivity"));
    }

    @Test
    void matchesInputSetEntityAllowsCanonical600Reuse() {
        assertTrue(OrcaOrderBundle600SubtypeSupport.matchesInputSetEntity(
                IInfoModel.ENTITY_PHYSIOLOGY_ORDER,
                "testOrder",
                "600"));
        assertTrue(OrcaOrderBundle600SubtypeSupport.matchesInputSetEntity(
                IInfoModel.ENTITY_BACTERIA_ORDER,
                "testOrder",
                "600"));
        assertFalse(OrcaOrderBundle600SubtypeSupport.matchesInputSetEntity(
                IInfoModel.ENTITY_BACTERIA_ORDER,
                "testOrder",
                "400"));
    }
}

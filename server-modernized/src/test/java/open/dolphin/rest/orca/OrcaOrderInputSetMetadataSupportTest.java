package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import open.dolphin.infomodel.IInfoModel;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

class OrcaOrderInputSetMetadataSupportTest {

    private static final Logger LOGGER = LoggerFactory.getLogger(OrcaOrderInputSetMetadataSupportTest.class);

    @Test
    void resolveClassMetadataMapsExactChargeAndOrderEntities() {
        assertEquals(
                IInfoModel.ENTITY_BASE_CHARGE_ORDER,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("110", LOGGER).entity());
        assertEquals(
                "再診加算料",
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("124", LOGGER).className());
        assertEquals(
                IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("130", LOGGER).entity());
        assertEquals(
                "在宅材料（院外処方）",
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("149", LOGGER).className());
        assertEquals(
                IInfoModel.ENTITY_TREATMENT,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("400", LOGGER).entity());
        assertEquals(
                "testOrder",
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("600", LOGGER).entity());
        assertEquals(
                "radiologyOrder",
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("700", LOGGER).entity());
        assertEquals(
                "otherOrder",
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("800", LOGGER).entity());
    }

    @Test
    void resolveClassMetadataMarksUnknownClassAsUnsupported() {
        OrcaOrderInputSetSupport.ClassMetadata metadata =
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("invalid", LOGGER);

        assertNotNull(metadata);
        assertEquals(OrcaOrderInputSetMetadataSupport.UNSUPPORTED_ENTITY, metadata.entity());
        assertEquals(OrcaOrderInputSetMetadataSupport.UNSUPPORTED_CLASS_NAME, metadata.className());
    }
}

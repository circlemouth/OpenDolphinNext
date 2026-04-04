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
    void resolveClassMetadataMaps200And400ToCanonicalEntities() {
        assertEquals(
                IInfoModel.ENTITY_BASE_CHARGE_ORDER,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("110", LOGGER).entity());
        assertEquals(
                OrcaChargeClassCanonicalSupport.BASE_CHARGE_CLASS_NAME,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("125", LOGGER).className());
        assertEquals(
                IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("130", LOGGER).entity());
        assertEquals(
                OrcaChargeClassCanonicalSupport.INSTRUCTION_CHARGE_CLASS_NAME,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("150", LOGGER).className());
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

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
    void resolveClassMetadataMapsExactReceiptCodesToCanonicalEntities() {
        assertEquals(
                IInfoModel.ENTITY_BASE_CHARGE_ORDER,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("110", LOGGER).entity());
        assertEquals(
                OrcaChargeClassCanonicalSupport.BASE_CHARGE_CLASS_NAME,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("124", LOGGER).className());
        assertEquals(
                IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("130", LOGGER).entity());
        assertEquals(
                OrcaChargeClassCanonicalSupport.INSTRUCTION_CHARGE_CLASS_NAME,
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
                OrcaMedicalClassCatalog.RADIOLOGY_LABEL,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("700", LOGGER).className());
        assertEquals(
                OrcaOrderInputSetMetadataSupport.UNSUPPORTED_ENTITY,
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

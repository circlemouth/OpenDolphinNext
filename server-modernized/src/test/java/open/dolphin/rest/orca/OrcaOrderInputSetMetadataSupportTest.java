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
                "基本診療料",
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("125", LOGGER).className());
        assertEquals(
                IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("130", LOGGER).entity());
        assertEquals(
                "医学管理等",
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("150", LOGGER).className());
        assertEquals(
                IInfoModel.ENTITY_TREATMENT,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("400", LOGGER).entity());
        assertEquals(
                "testOrder",
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("600", LOGGER).entity());
        assertEquals(
                IInfoModel.ENTITY_RADIOLOGY_ORDER,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("700", LOGGER).entity());
        assertEquals(
                IInfoModel.ENTITY_OTHER_ORDER,
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("800", LOGGER).entity());
    }

    @Test
    void resolveClassMetadataFallsBackToGeneralEntity() {
        OrcaOrderInputSetSupport.ClassMetadata metadata =
                OrcaOrderInputSetMetadataSupport.resolveClassMetadata("invalid", LOGGER);

        assertNotNull(metadata);
        assertEquals(IInfoModel.ENTITY_GENERAL_ORDER, metadata.entity());
        assertEquals("汎用", metadata.className());
    }
}

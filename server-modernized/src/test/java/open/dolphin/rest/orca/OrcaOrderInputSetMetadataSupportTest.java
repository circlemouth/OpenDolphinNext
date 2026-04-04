package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

class OrcaOrderInputSetMetadataSupportTest {

    private static final Logger LOGGER = LoggerFactory.getLogger(OrcaOrderInputSetMetadataSupportTest.class);

    @Test
    void resolveClassMetadataMaps200And400ToCanonicalEntities() {
        assertEquals(
                "treatmentOrder",
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

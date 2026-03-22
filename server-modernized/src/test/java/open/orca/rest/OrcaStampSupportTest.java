package open.orca.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class OrcaStampSupportTest {

    @Test
    void parseStampRequestPrefersQueryDateOverEmbeddedDate() {
        OrcaStampSupport.StampRequest request = OrcaStampSupport.parseStampRequest(
                "P01001,降圧セット,2024-01-01",
                "2025-03-21",
                value -> value.replace("-", ""));

        assertEquals("P01001", request.setCd());
        assertEquals("降圧セット", request.stampName());
        assertEquals("20250321", request.effectiveDate());
    }
}

package open.orca.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.WebApplicationException;
import java.util.Map;
import org.junit.jupiter.api.Test;

class OrcaDepartmentInfoSupportTest {

    @Test
    void sanitizeResponseReplacesTagsWithCommas() {
        String sanitized = OrcaDepartmentInfoSupport.sanitizeResponse(
                "<data><item>internal</item><dept>01</dept></data>");

        assertTrue(sanitized.contains("internal"));
        assertTrue(sanitized.contains("01"));
        assertTrue(sanitized.contains(","));
    }

    @Test
    void orcaUnavailableBuildsSafeErrorBody() {
        WebApplicationException exception = OrcaDepartmentInfoSupport.orcaUnavailable();

        assertEquals(503, exception.getResponse().getStatus());
        Object entity = exception.getResponse().getEntity();
        assertInstanceOf(Map.class, entity);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) entity;
        assertEquals("orca_unavailable", body.get("code"));
        assertEquals("orca_unavailable", body.get("errorCategory"));
        assertEquals("ORCA 診療科情報の取得に失敗しました。", body.get("message"));
    }
}

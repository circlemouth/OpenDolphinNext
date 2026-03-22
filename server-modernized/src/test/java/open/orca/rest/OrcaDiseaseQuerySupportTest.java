package open.orca.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class OrcaDiseaseQuerySupportTest {

    @Test
    void parseDiseaseRequestUsesLegacyPathShapeWhenFourParamsExist() {
        OrcaDiseaseQuerySupport.DiseaseRequest request = OrcaDiseaseQuerySupport.parseDiseaseRequest(
                "00001,20240101,20240331,false",
                null,
                null,
                null,
                null,
                value -> value,
                value -> "20250321",
                (value, defaultValue) -> defaultValue);

        assertEquals("00001", request.patientId());
        assertEquals("20240101", request.from());
        assertEquals("20240331", request.to());
        assertFalse(request.ascend());
        assertFalse(request.activeOnly());
    }

    @Test
    void parseDiseaseRequestUsesQueryFlagsForModernPathShape() {
        OrcaDiseaseQuerySupport.DiseaseRequest request = OrcaDiseaseQuerySupport.parseDiseaseRequest(
                "00001",
                "2024-01-01",
                "",
                "true",
                "false",
                value -> value == null ? null : value.replace("-", ""),
                value -> "20250321",
                (value, defaultValue) -> value == null || value.isBlank() ? defaultValue : Boolean.parseBoolean(value));

        assertEquals("00001", request.patientId());
        assertEquals("20240101", request.from());
        assertEquals("20250321", request.to());
        assertFalse(request.ascend());
        assertTrue(request.activeOnly());
    }
}

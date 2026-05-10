package open.dolphin.orca.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class OrcaApiResultTest {

    @Test
    void classifiesWarningUnmatchedAndUnknownAsReviewRequired() {
        assertEquals(
                OrcaApiResult.OperationStatus.ORCA_WARNING,
                OrcaApiResult.classifyMutation(true, "0000", true, false, true));
        assertEquals(
                OrcaApiResult.OperationStatus.ORCA_UNMATCHED,
                OrcaApiResult.classifyMutation(true, "0000", false, true, true));
        assertEquals(
                OrcaApiResult.OperationStatus.UNKNOWN,
                OrcaApiResult.classifyMutation(true, "0000", false, false, false));
        assertTrue(OrcaApiResult.needsUserReview(OrcaApiResult.OperationStatus.UNKNOWN));
    }

    @Test
    void classifiesTransportAuthAndCertificateFailuresDistinctly() {
        assertEquals(
                OrcaApiResult.OperationStatus.AUTH_FAILED,
                OrcaApiResult.classifyTransportFailure(401, null));
        assertEquals(
                OrcaApiResult.OperationStatus.CERTIFICATE_FAILED,
                OrcaApiResult.classifyTransportFailure(null, "TLS certificate validation failed"));
        assertEquals(
                OrcaApiResult.OperationStatus.NETWORK_FAILED,
                OrcaApiResult.classifyTransportFailure(503, "gateway timeout"));
    }

    @Test
    void storesOnlySanitizedSummaryFields() {
        OrcaApiResult result = OrcaApiResult.builder()
                .apiResult("0000")
                .message("OK")
                .warnings(List.of(" warning "))
                .unmatched(List.of(" U001 "))
                .operationStatus(OrcaApiResult.OperationStatus.ORCA_UNMATCHED)
                .needsUserReview(true)
                .performDate("2026-05-10")
                .departmentCode("01")
                .physicianCode("10001")
                .insuranceCombinationNumber("0001")
                .rawHash("sha256:raw")
                .normalizedResponse("{\"status\":\"sanitized\"}")
                .normalizedResponseHash("sha256:normalized")
                .build();

        assertEquals("0000", result.apiResult());
        assertEquals(List.of("warning"), result.warnings());
        assertEquals(List.of("U001"), result.unmatched());
        assertEquals(OrcaApiResult.OperationStatus.ORCA_UNMATCHED, result.operationStatus());
        assertTrue(result.needsUserReview());
        assertEquals("sha256:raw", result.rawHash());
        assertEquals("{\"status\":\"sanitized\"}", result.normalizedResponse());
    }
}

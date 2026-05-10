package open.dolphin.orca.transport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import open.dolphin.orca.model.OrcaApiResult;
import org.junit.jupiter.api.Test;

class OrcaHttpClientSupportTest {

    private final OrcaHttpClientSupport support = new OrcaHttpClientSupport();

    @Test
    void extractApiResultReadsXmlWarnings() {
        String xml = """
                <data>
                  <Api_Result>0000</Api_Result>
                  <Api_Result_Message>OK</Api_Result_Message>
                  <Api_Warning_Message> warning-one </Api_Warning_Message>
                </data>
                """;

        OrcaApiResult result = support.extractApiResult(xml, "application/xml");

        assertEquals("0000", result.apiResult());
        assertEquals("OK", result.message());
        assertEquals(1, result.warnings().size());
        assertEquals("warning-one", result.warnings().get(0));
    }

    @Test
    void extractApiResultReadsJsonBody() {
        String json = """
                {"response":{"Api_Result":"0100","Api_Result_Message":"ERR","Api_Warning_Message":"warn"}}
                """;

        OrcaApiResult result = support.extractApiResult(json, "application/json");

        assertEquals("0100", result.apiResult());
        assertEquals("ERR", result.message());
        assertEquals(1, result.warnings().size());
        assertEquals("warn", result.warnings().get(0));
    }

    @Test
    void isTransientOrcaErrorRecognizesLockMessages() {
        OrcaApiResult result =
                OrcaApiResult.of("0100", "他端末で処理中", java.util.List.of());

        assertTrue(support.isTransientOrcaError(result));
        assertFalse(support.isTransientOrcaError(OrcaApiResult.of("0000", "OK", java.util.List.of())));
    }
}

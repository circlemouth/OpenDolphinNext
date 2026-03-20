package open.dolphin.orca.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.service.OrcaWrapperService;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.orca.transport.StubOrcaTransport;
import org.junit.jupiter.api.Test;

class DefaultOrcaPatientAdapterStubIntegrationTest {

    @Test
    void searchPatients_usesStubAndReturnsNormalizedRows() {
        StubOrcaTransport transport = new StubOrcaTransport();
        OrcaWrapperService wrapperService = new OrcaWrapperService(transport, new OrcaXmlMapper());
        DefaultOrcaPatientAdapter adapter = new DefaultOrcaPatientAdapter(wrapperService, transport);

        OrcaPatientAdapter.PatientSearchQuery query = new OrcaPatientAdapter.PatientSearchQuery(
                "F001", null, "山田", null, null);

        OrcaPatientAdapter.SearchResult result = adapter.searchPatients(query);

        assertNotNull(result);
        assertEquals("real", result.sourceSystem());
        assertFalse(result.patients().isEmpty());
        assertEquals("000001", result.patients().get(0).get("patientId"));
        assertEquals("山田太郎", result.patients().get(0).get("wholeName"));
    }

    @Test
    void upsertPatient_usesStubPatientModAndReturnsSuccess() {
        StubOrcaTransport transport = new StubOrcaTransport();
        OrcaWrapperService wrapperService = new OrcaWrapperService(transport, new OrcaXmlMapper());
        DefaultOrcaPatientAdapter adapter = new DefaultOrcaPatientAdapter(wrapperService, transport);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("modKey", "1");
        payload.put("wholeName", "山田太郎");
        payload.put("wholeNameKana", "ヤマダタロウ");
        payload.put("birthDate", "1975-04-01");
        payload.put("sex", "1");
        payload.put("address", "東京都千代田区1-1-1");
        payload.put("phoneNumber1", "0311112222");
        payload.put("runId", "run-test-01");
        payload.put("operation", "create");

        OrcaPatientAdapter.PatientUpsertCommand command = new OrcaPatientAdapter.PatientUpsertCommand(
                "F001", "000001", payload);

        OrcaPatientAdapter.UpsertResult result = adapter.upsertPatient(command);

        assertNotNull(result);
        assertEquals("000001", result.patientId());
        assertEquals("000001", result.orcaPatientKey());
        assertEquals("run-test-01", result.runId());
        assertEquals(true, result.created());
    }

    @Test
    void registerReception_usesStubAcceptmodAndReturnsAcceptanceId() {
        StubOrcaTransport transport = new StubOrcaTransport();
        OrcaWrapperService wrapperService = new OrcaWrapperService(transport, new OrcaXmlMapper());
        DefaultOrcaPatientAdapter adapter = new DefaultOrcaPatientAdapter(wrapperService, transport);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("requestNumber", "01");
        payload.put("acceptanceDate", "2025-11-16");
        payload.put("acceptanceTime", "09:00:00");

        OrcaPatientAdapter.ReceptionCommand command = new OrcaPatientAdapter.ReceptionCommand(
                "F001", "000001", "01", "1001", "2025-11-16", payload);

        OrcaPatientAdapter.ReceptionResult result = adapter.registerReception(command);

        assertNotNull(result);
        assertEquals("A20251116001", result.receptionId());
        assertEquals("000001", result.patientId());
        assertEquals("0000", result.status());
        assertNotNull(result.runId());
    }

    @Test
    void upsertPatient_throwsWhenApiResultIsFailure() {
        OrcaTransport transport = new FailPatientModTransport();
        OrcaWrapperService wrapperService = new OrcaWrapperService(transport, new OrcaXmlMapper());
        DefaultOrcaPatientAdapter adapter = new DefaultOrcaPatientAdapter(wrapperService, transport);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("wholeName", "山田太郎");
        payload.put("wholeNameKana", "ヤマダタロウ");
        payload.put("birthDate", "1975-04-01");
        payload.put("sex", "1");

        OrcaPatientAdapter.PatientUpsertCommand command = new OrcaPatientAdapter.PatientUpsertCommand(
                "F001", "000001", payload);

        assertThrows(OrcaGatewayException.class, () -> adapter.upsertPatient(command));
    }

    private static final class FailPatientModTransport implements OrcaTransport {

        @Override
        public String invoke(OrcaEndpoint endpoint, String requestXml) {
            return invokeDetailed(endpoint, OrcaTransportRequest.post(requestXml)).getBody();
        }

        @Override
        public OrcaTransportResult invokeDetailed(OrcaEndpoint endpoint, OrcaTransportRequest request) {
            if (endpoint == OrcaEndpoint.PATIENT_MOD) {
                String body = "<xmlio2><patientmodres><Api_Result>E999</Api_Result>"
                        + "<Api_Result_Message>validation error</Api_Result_Message></patientmodres></xmlio2>";
                return OrcaTransportResult.fallback(body, "application/xml");
            }
            String body = "<xmlio2><acceptres><Api_Result>0000</Api_Result><Api_Result_Message>OK</Api_Result_Message></acceptres></xmlio2>";
            return OrcaTransportResult.fallback(body, "application/xml");
        }
    }
}

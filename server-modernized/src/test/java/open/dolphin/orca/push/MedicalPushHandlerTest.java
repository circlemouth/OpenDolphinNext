package open.dolphin.orca.push;

import static org.junit.jupiter.api.Assertions.assertEquals;

import open.dolphin.metrics.OrcaPushMetricsRegistrar;
import open.dolphin.orca.push.dto.OrcaPushEventData;
import open.dolphin.orca.push.dto.OrcaPushMedicalBody;
import open.dolphin.orca.push.dto.OrcaPushMedicalInformation;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import org.junit.jupiter.api.Test;

class MedicalPushHandlerTest {

    @Test
    void multipleInvoicesInvokeMedicalGetPerItem() {
        MedicalPushHandler handler = new MedicalPushHandler();
        RecordingTransport transport = new RecordingTransport();
        handler.orcaTransport = transport;
        handler.seenEventStore = new StubSeenEventStore(true);
        handler.stateStore = new RecordingStateStore();
        handler.metricsRegistrar = new OrcaPushMetricsRegistrar();
        handler.configurationResolver = new ServerConfigurationResolver(java.util.Map.of());

        handler.handle("F001", eventWithInvoices("INV-1", "INV-2"));

        assertEquals(2, transport.invocationCount);
        assertEquals(OrcaEndpoint.MEDICAL_GET, transport.lastEndpoint);
        assertEquals("class=02", transport.lastRequest.getQuery());
    }

    @Test
    void missingInvoiceFallsBackToSequentialNumberOne() {
        MedicalPushHandler handler = new MedicalPushHandler();
        RecordingTransport transport = new RecordingTransport();
        handler.orcaTransport = transport;
        handler.seenEventStore = new StubSeenEventStore(true);
        handler.stateStore = new RecordingStateStore();
        handler.metricsRegistrar = new OrcaPushMetricsRegistrar();
        handler.configurationResolver = new ServerConfigurationResolver(java.util.Map.of());

        handler.handle("F001", eventWithInvoices((String) null));

        assertEquals(1, transport.invocationCount);
        assertEquals(true, transport.lastRequest.getBody().contains("<Sequential_Number type=\"string\">1</Sequential_Number>"));
    }

    private static OrcaPushEventData eventWithInvoices(String... invoices) {
        OrcaPushMedicalBody body = new OrcaPushMedicalBody();
        body.setPatient_ID("P001");
        body.setPerform_Date("2026-03-22");
        java.util.List<OrcaPushMedicalInformation> list = new java.util.ArrayList<>();
        for (String invoice : invoices) {
            OrcaPushMedicalInformation information = new OrcaPushMedicalInformation();
            information.setDepartment_Code("01");
            information.setInsurance_Combination_Number("0001");
            information.setInvoice_Number(invoice);
            list.add(information);
        }
        body.setMedical_Information(list);
        OrcaPushEventData eventData = new OrcaPushEventData();
        eventData.setUuid("U-1");
        eventData.setEvent("patient_account");
        eventData.setBody(body);
        eventData.setTime("2026-03-22T09:00:00Z");
        return eventData;
    }

    private static final class RecordingTransport implements OrcaTransport {
        private int invocationCount;
        private OrcaEndpoint lastEndpoint;
        private OrcaTransportRequest lastRequest;

        @Override
        public String invoke(OrcaEndpoint endpoint, String requestXml) {
            throw new UnsupportedOperationException();
        }

        @Override
        public OrcaTransportResult invokeDetailed(OrcaEndpoint endpoint, OrcaTransportRequest request) {
            invocationCount++;
            lastEndpoint = endpoint;
            lastRequest = request;
            return OrcaTransportResult.fallback("<data><medicalgetres><Api_Result>0000</Api_Result></medicalgetres></data>", "application/xml");
        }
    }

    private static final class RecordingStateStore extends OrcaPushStateStore {
    }

    private static final class StubSeenEventStore extends OrcaPushSeenEventStore {
        private final boolean markSeen;

        private StubSeenEventStore(boolean markSeen) {
            this.markSeen = markSeen;
        }

        @Override
        public boolean markSeen(String facilityId, String eventUuid, String eventName, java.time.Instant eventTime, int retentionDays) {
            return markSeen;
        }
    }
}

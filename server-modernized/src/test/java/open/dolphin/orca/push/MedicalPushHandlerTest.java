package open.dolphin.orca.push;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
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
        RecordingInboxStore inboxStore = new RecordingInboxStore();
        handler.eventInboxStore = inboxStore;
        handler.connectionStateStore = new RecordingConnectionStateStore();
        handler.metricsRegistrar = new OrcaPushMetricsRegistrar();
        handler.configurationResolver = new ServerConfigurationResolver(java.util.Map.of());

        handler.handle("F001", eventWithInvoices("INV-1", "INV-2"));

        assertEquals("F001", transport.lastFacilityId);
        assertEquals(2, transport.invocationCount);
        assertEquals(OrcaEndpoint.MEDICAL_GET, transport.lastEndpoint);
        assertEquals("class=02", transport.lastRequest.getQuery());
        assertEquals("applied", inboxStore.status("F001", "U-1"));
    }

    @Test
    void missingInvoiceFallsBackToSequentialNumberOne() {
        MedicalPushHandler handler = new MedicalPushHandler();
        RecordingTransport transport = new RecordingTransport();
        handler.orcaTransport = transport;
        handler.eventInboxStore = new RecordingInboxStore();
        handler.connectionStateStore = new RecordingConnectionStateStore();
        handler.metricsRegistrar = new OrcaPushMetricsRegistrar();
        handler.configurationResolver = new ServerConfigurationResolver(java.util.Map.of());

        handler.handle("F001", eventWithInvoices((String) null));

        assertEquals("F001", transport.lastFacilityId);
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
        private String lastFacilityId;
        private OrcaEndpoint lastEndpoint;
        private OrcaTransportRequest lastRequest;

        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            lastFacilityId = facilityId;
            invocationCount++;
            lastEndpoint = endpoint;
            lastRequest = request;
            return OrcaTransportResult.fallback("<data><medicalgetres><Api_Result>0000</Api_Result></medicalgetres></data>", "application/xml");
        }
    }

    private static final class RecordingConnectionStateStore extends OrcaPushConnectionStateStore {
    }

    private static final class RecordingInboxStore extends OrcaPushEventInboxStore {
        private final Map<String, EventInboxRow> rows = new HashMap<>();

        @Override
        public boolean isApplied(String facilityId, String streamKind, String eventUuid) {
            EventInboxRow row = rows.get(facilityId + ":" + eventUuid);
            return row != null && row.appliedAt() != null;
        }

        @Override
        public void markReceived(String facilityId, String streamKind, String eventUuid, String eventName, Instant eventTime,
                String payloadJson, String lastRecoveryRunId) {
            rows.put(facilityId + ":" + eventUuid, new EventInboxRow(
                    facilityId, streamKind, eventUuid, eventName, eventTime, "received",
                    Instant.now(), null, null, null, null, null, payloadJson, lastRecoveryRunId));
        }

        @Override
        public void markFetched(String facilityId, String streamKind, String eventUuid, Instant fetchedAt, String lastRecoveryRunId) {
            EventInboxRow row = rows.get(facilityId + ":" + eventUuid);
            rows.put(facilityId + ":" + eventUuid, new EventInboxRow(
                    facilityId, streamKind, eventUuid, row.eventName(), row.eventTime(), "fetched",
                    row.receivedAt(), fetchedAt, row.appliedAt(), row.failedAt(), row.errorCode(), row.errorMessage(),
                    row.payloadJson(), lastRecoveryRunId));
        }

        @Override
        public void markApplied(String facilityId, String streamKind, String eventUuid, Instant appliedAt, String lastRecoveryRunId) {
            EventInboxRow row = rows.get(facilityId + ":" + eventUuid);
            if (row == null) {
                row = new EventInboxRow(
                        facilityId, streamKind, eventUuid, "patient_account", null, "received",
                        Instant.now(), null, null, null, null, null, "{}", lastRecoveryRunId);
            }
            rows.put(facilityId + ":" + eventUuid, new EventInboxRow(
                    facilityId, streamKind, eventUuid, row.eventName(), row.eventTime(), "applied",
                    row.receivedAt(), row.fetchedAt(), appliedAt, null, null, null, row.payloadJson(), lastRecoveryRunId));
        }

        @Override
        public void markFailed(String facilityId, String streamKind, String eventUuid, Instant failedAt, String errorCode,
                String errorMessage, String lastRecoveryRunId) {
            EventInboxRow row = rows.get(facilityId + ":" + eventUuid);
            rows.put(facilityId + ":" + eventUuid, new EventInboxRow(
                    facilityId, streamKind, eventUuid, row.eventName(), row.eventTime(), "failed",
                    row.receivedAt(), row.fetchedAt(), row.appliedAt(), failedAt, errorCode, errorMessage,
                    row.payloadJson(), lastRecoveryRunId));
        }

        private String status(String facilityId, String eventUuid) {
            EventInboxRow row = rows.get(facilityId + ":" + eventUuid);
            return row != null ? row.status() : null;
        }
    }
}

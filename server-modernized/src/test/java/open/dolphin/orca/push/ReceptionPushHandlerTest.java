package open.dolphin.orca.push;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import open.dolphin.metrics.OrcaPushMetricsRegistrar;
import open.dolphin.orca.push.dto.OrcaPushEventData;
import open.dolphin.orca.push.dto.OrcaPushReceptionBody;
import open.dolphin.orca.service.DefaultOrcaLiveGateway;
import open.dolphin.rest.ReceptionRealtimeSseSupport;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import open.dolphin.rest.dto.orca.VisitMutationResponse;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import org.junit.jupiter.api.Test;

class ReceptionPushHandlerTest {

    @Test
    void addEventQueriesVisitAndPublishesRealtimeUpdate() {
        ReceptionPushHandler handler = new ReceptionPushHandler();
        RecordingWrapperService wrapperService = new RecordingWrapperService();
        RecordingRealtimeSseSupport realtimeSseSupport = new RecordingRealtimeSseSupport();
        wrapperService.response = successResponse("2026-03-22");
        handler.wrapperService = wrapperService;
        handler.realtimeSseSupport = realtimeSseSupport;
        handler.configurationResolver = new ServerConfigurationResolver(java.util.Map.of(
                ServerConfigurationResolver.KEY_ORCA_PUSH_DEDUP_RETENTION_DAYS, "14"));
        RecordingInboxStore inboxStore = new RecordingInboxStore();
        handler.eventInboxStore = inboxStore;
        handler.metricsRegistrar = new OrcaPushMetricsRegistrar();

        handler.handle("F001", addEvent("U-1", "add"));

        assertEquals("F001", wrapperService.facilityId);
        assertEquals("00", wrapperService.request.getRequestNumber());
        assertEquals("P001", wrapperService.request.getPatientId());
        assertEquals("2026-03-22", realtimeSseSupport.date);
        assertEquals("01", realtimeSseSupport.requestNumber);
        assertEquals("applied", inboxStore.status("F001", "U-1"));
    }

    @Test
    void duplicateEventIsSkipped() {
        ReceptionPushHandler handler = new ReceptionPushHandler();
        RecordingWrapperService wrapperService = new RecordingWrapperService();
        RecordingRealtimeSseSupport realtimeSseSupport = new RecordingRealtimeSseSupport();
        handler.wrapperService = wrapperService;
        handler.realtimeSseSupport = realtimeSseSupport;
        handler.configurationResolver = new ServerConfigurationResolver(java.util.Map.of());
        RecordingInboxStore inboxStore = new RecordingInboxStore();
        inboxStore.markApplied("F001", ReceptionPushHandler.STREAM_KIND, "U-2", Instant.now(), null);
        handler.eventInboxStore = inboxStore;
        handler.metricsRegistrar = new OrcaPushMetricsRegistrar();

        handler.handle("F001", addEvent("U-2", "add"));

        assertNull(wrapperService.request);
        assertNull(realtimeSseSupport.date);
        assertEquals("applied", inboxStore.status("F001", "U-2"));
    }

    @Test
    void failedPullTriggersReplayGap() {
        ReceptionPushHandler handler = new ReceptionPushHandler();
        RecordingWrapperService wrapperService = new RecordingWrapperService();
        RecordingRealtimeSseSupport realtimeSseSupport = new RecordingRealtimeSseSupport();
        handler.wrapperService = wrapperService;
        handler.realtimeSseSupport = realtimeSseSupport;
        handler.configurationResolver = new ServerConfigurationResolver(java.util.Map.of());
        RecordingInboxStore inboxStore = new RecordingInboxStore();
        handler.eventInboxStore = inboxStore;
        handler.metricsRegistrar = new OrcaPushMetricsRegistrar();

        handler.handle("F001", addEvent("U-3", "modify"));

        assertEquals("F001", realtimeSseSupport.replayGapFacilityId);
        assertEquals("failed", inboxStore.status("F001", "U-3"));
    }

    private static OrcaPushEventData addEvent(String uuid, String mode) {
        OrcaPushReceptionBody body = new OrcaPushReceptionBody();
        body.setPatient_Mode(mode);
        body.setPatient_ID("P001");
        body.setAccept_Date("2026-03-22");
        body.setAccept_Time("09:00:00");
        body.setDepartment_Code("01");
        body.setPhysician_Code("100");
        OrcaPushEventData eventData = new OrcaPushEventData();
        eventData.setUuid(uuid);
        eventData.setEvent("patient_accept");
        eventData.setBody(body);
        eventData.setTime("2026-03-22T09:00:00Z");
        return eventData;
    }

    private static VisitMutationResponse successResponse(String acceptanceDate) {
        VisitMutationResponse response = new VisitMutationResponse();
        response.setApiResult("0000");
        response.setAcceptanceDate(acceptanceDate);
        response.setRunId("RUN-1");
        return response;
    }

    private static final class RecordingWrapperService extends DefaultOrcaLiveGateway {
        private VisitMutationRequest request;
        private String facilityId;
        private VisitMutationResponse response;

        @Override
        public VisitMutationResponse mutateVisit(String facilityId, VisitMutationRequest request) {
            this.facilityId = facilityId;
            this.request = request;
            return response;
        }
    }

    private static final class RecordingRealtimeSseSupport extends ReceptionRealtimeSseSupport {
        private String date;
        private String requestNumber;
        private String replayGapFacilityId;

        @Override
        public void publishReceptionUpdate(String facilityId, String date, String patientId, String requestNumber, String runId) {
            this.date = date;
            this.requestNumber = requestNumber;
        }

        @Override
        public void publishReplayGap(String facilityId) {
            this.replayGapFacilityId = facilityId;
        }
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
                        facilityId, streamKind, eventUuid, "patient_accept", null, "received",
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

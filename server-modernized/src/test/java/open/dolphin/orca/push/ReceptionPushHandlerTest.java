package open.dolphin.orca.push;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import open.dolphin.metrics.OrcaPushMetricsRegistrar;
import open.dolphin.orca.push.dto.OrcaPushEventData;
import open.dolphin.orca.push.dto.OrcaPushReceptionBody;
import open.dolphin.orca.service.OrcaWrapperService;
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
        handler.seenEventStore = new StubSeenEventStore(true);
        handler.metricsRegistrar = new OrcaPushMetricsRegistrar();

        handler.handle("F001", addEvent("U-1", "add"));

        assertEquals("00", wrapperService.request.getRequestNumber());
        assertEquals("P001", wrapperService.request.getPatientId());
        assertEquals("2026-03-22", realtimeSseSupport.date);
        assertEquals("01", realtimeSseSupport.requestNumber);
    }

    @Test
    void duplicateEventIsSkipped() {
        ReceptionPushHandler handler = new ReceptionPushHandler();
        RecordingWrapperService wrapperService = new RecordingWrapperService();
        RecordingRealtimeSseSupport realtimeSseSupport = new RecordingRealtimeSseSupport();
        handler.wrapperService = wrapperService;
        handler.realtimeSseSupport = realtimeSseSupport;
        handler.configurationResolver = new ServerConfigurationResolver(java.util.Map.of());
        handler.seenEventStore = new StubSeenEventStore(false);
        handler.metricsRegistrar = new OrcaPushMetricsRegistrar();

        handler.handle("F001", addEvent("U-2", "add"));

        assertNull(wrapperService.request);
        assertNull(realtimeSseSupport.date);
    }

    @Test
    void failedPullTriggersReplayGap() {
        ReceptionPushHandler handler = new ReceptionPushHandler();
        RecordingWrapperService wrapperService = new RecordingWrapperService();
        RecordingRealtimeSseSupport realtimeSseSupport = new RecordingRealtimeSseSupport();
        handler.wrapperService = wrapperService;
        handler.realtimeSseSupport = realtimeSseSupport;
        handler.configurationResolver = new ServerConfigurationResolver(java.util.Map.of());
        handler.seenEventStore = new StubSeenEventStore(true);
        handler.metricsRegistrar = new OrcaPushMetricsRegistrar();

        handler.handle("F001", addEvent("U-3", "modify"));

        assertEquals("F001", realtimeSseSupport.replayGapFacilityId);
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

    private static final class RecordingWrapperService extends OrcaWrapperService {
        private VisitMutationRequest request;
        private VisitMutationResponse response;

        @Override
        public VisitMutationResponse mutateVisit(VisitMutationRequest request) {
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

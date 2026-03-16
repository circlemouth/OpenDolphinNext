package open.dolphin.orca.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import open.dolphin.orca.service.OrcaWrapperService;
import open.dolphin.rest.ReceptionRealtimeSseSupport;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import open.dolphin.rest.dto.orca.VisitMutationResponse;
import org.junit.jupiter.api.Test;

class OrcaVisitResourceRealtimeTest {

    @Test
    void publishesRealtimeUpdateWhenVisitMutationSucceeds() {
        StubWrapperService wrapperService = new StubWrapperService();
        VisitMutationResponse response = new VisitMutationResponse();
        response.setApiResult("0000");
        response.setApiResultMessage("OK");
        response.setRunId("RUN-REALTIME-001");
        wrapperService.response = response;

        RecordingRealtimeSupport realtime = new RecordingRealtimeSupport();
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);
        resource.setReceptionRealtimeSseSupportForTest(realtime);

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("02");
        request.setPatientId("000001");
        request.setAcceptanceDate("2026-02-19");
        request.setAcceptanceTime("09:00:00");

        resource.mutateVisit(createRequest("F001:doctor01"), request);

        assertEquals("F001", realtime.facilityId);
        assertEquals("2026-02-19", realtime.date);
        assertEquals("000001", realtime.patientId);
        assertEquals("02", realtime.requestNumber);
        assertTrue(realtime.runId != null && realtime.runId.matches("\\d{8}T\\d{6}Z"));
    }

    @Test
    void doesNotPublishRealtimeUpdateForQueryMutation() {
        StubWrapperService wrapperService = new StubWrapperService();
        VisitMutationResponse response = new VisitMutationResponse();
        response.setApiResult("0000");
        response.setApiResultMessage("OK");
        wrapperService.response = response;

        RecordingRealtimeSupport realtime = new RecordingRealtimeSupport();
        OrcaVisitResource resource = new OrcaVisitResource();
        resource.setWrapperService(wrapperService);
        resource.setReceptionRealtimeSseSupportForTest(realtime);

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("00");
        request.setPatientId("000001");

        resource.mutateVisit(createRequest("F001:doctor01"), request);

        assertNull(realtime.facilityId);
    }

    private HttpServletRequest createRequest(String remoteUser) {
        Map<String, Object> attributes = new HashMap<>();
        return (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    switch (method.getName()) {
                        case "getRemoteUser":
                            return remoteUser;
                        case "getRequestURI":
                            return "/api/orca/visits/mutation";
                        case "getRemoteAddr":
                            return "127.0.0.1";
                        case "getAttribute":
                            if (args != null && args.length == 1) {
                                return attributes.get(String.valueOf(args[0]));
                            }
                            return null;
                        case "setAttribute":
                            if (args != null && args.length == 2) {
                                attributes.put(String.valueOf(args[0]), args[1]);
                            }
                            return null;
                        default:
                            return null;
                    }
                });
    }

    private static final class StubWrapperService extends OrcaWrapperService {
        private VisitMutationResponse response;

        @Override
        public VisitMutationResponse mutateVisit(VisitMutationRequest request) {
            return response;
        }
    }

    private static final class RecordingRealtimeSupport extends ReceptionRealtimeSseSupport {
        private String facilityId;
        private String date;
        private String patientId;
        private String requestNumber;
        private String runId;

        @Override
        public void publishReceptionUpdate(String facilityId, String date, String patientId, String requestNumber, String runId) {
            this.facilityId = facilityId;
            this.date = date;
            this.patientId = patientId;
            this.requestNumber = requestNumber;
            this.runId = runId;
        }
    }
}

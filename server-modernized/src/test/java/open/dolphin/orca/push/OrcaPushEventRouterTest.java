package open.dolphin.orca.push;

import static org.junit.jupiter.api.Assertions.assertEquals;

import open.dolphin.metrics.OrcaPushMetricsRegistrar;
import open.dolphin.orca.push.dto.OrcaPushEnvelope;
import open.dolphin.orca.push.dto.OrcaPushEventData;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import org.junit.jupiter.api.Test;

class OrcaPushEventRouterTest {

    @Test
    void subscribedUpdatesState() {
        OrcaPushEventRouter router = new OrcaPushEventRouter();
        RecordingStateStore stateStore = new RecordingStateStore();
        router.stateStore = stateStore;
        router.receptionPushHandler = new NoopReceptionPushHandler();
        router.medicalPushHandler = new NoopMedicalPushHandler();
        router.metricsRegistrar = new OrcaPushMetricsRegistrar();
        router.configurationResolver = new ServerConfigurationResolver(java.util.Map.of());

        OrcaPushEnvelope envelope = new OrcaPushEnvelope();
        envelope.setCommand("subscribed");

        router.handle("F001", "wss://push.example", envelope);

        assertEquals(OrcaPushStateStore.STATUS_CONNECTED, stateStore.lastStatus);
    }

    @Test
    void patientAcceptIsDispatchedToReceptionHandler() {
        OrcaPushEventRouter router = new OrcaPushEventRouter();
        RecordingReceptionHandler receptionHandler = new RecordingReceptionHandler();
        router.stateStore = new RecordingStateStore();
        router.receptionPushHandler = receptionHandler;
        router.medicalPushHandler = new NoopMedicalPushHandler();
        router.metricsRegistrar = new OrcaPushMetricsRegistrar();
        router.configurationResolver = new ServerConfigurationResolver(java.util.Map.of());

        OrcaPushEnvelope envelope = new OrcaPushEnvelope();
        envelope.setCommand("event");
        OrcaPushEventData data = new OrcaPushEventData();
        data.setEvent("patient_accept");
        data.setUuid("U-1");
        envelope.setData(data);

        router.handle("F001", "wss://push.example", envelope);

        assertEquals("F001", receptionHandler.facilityId);
    }

    private static final class RecordingStateStore extends OrcaPushStateStore {
        private String lastStatus;

        @Override
        public void markConnected(String facilityId, String websocketUrl) {
            lastStatus = STATUS_CONNECTED;
        }

        @Override
        public void markDisconnected(String facilityId, String websocketUrl, String error) {
            lastStatus = STATUS_DISCONNECTED;
        }

        @Override
        public void markDegraded(String facilityId, String websocketUrl, String error) {
            lastStatus = STATUS_DEGRADED;
        }
    }

    private static final class RecordingReceptionHandler extends ReceptionPushHandler {
        private String facilityId;

        @Override
        public void handle(String facilityId, OrcaPushEventData eventData) {
            this.facilityId = facilityId;
        }
    }

    private static final class NoopReceptionPushHandler extends ReceptionPushHandler {
    }

    private static final class NoopMedicalPushHandler extends MedicalPushHandler {
    }
}

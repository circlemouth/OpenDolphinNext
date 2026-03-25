package open.dolphin.orca.push;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.metrics.OrcaPushMetricsRegistrar;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.runtime.config.ServerConfigurationResolver;

@ApplicationScoped
public class OrcaPushRecoveryService {

    private static final Logger LOGGER = Logger.getLogger(OrcaPushRecoveryService.class.getName());

    @Inject
    ServerConfigurationResolver configurationResolver;

    @Inject
    OrcaTransport orcaTransport;

    @Inject
    OrcaPushEventRouter router;

    @Inject
    OrcaPushConnectionStateStore connectionStateStore;

    @Inject
    OrcaPushCursorStore cursorStore;

    @Inject
    OrcaPushMetricsRegistrar metricsRegistrar;

    public void recoverStartup(String facilityId, String websocketUrl) {
        recover(facilityId, websocketUrl, "startup");
    }

    public void recoverReconnect(String facilityId, String websocketUrl) {
        recover(facilityId, websocketUrl, "reconnect");
    }

    public void recoverScheduled(String facilityId, String websocketUrl) {
        recover(facilityId, websocketUrl, "scheduled");
    }

    void recover(String facilityId, String websocketUrl, String reason) {
        facilityId = requireFacilityId(facilityId);
        if (configurationResolver == null || !configurationResolver.orcaPush().recoveryEnabled()) {
            return;
        }
        Instant windowEnd = Instant.now();
        int lookbackMinutes = configurationResolver.orcaPush().recoveryInitialLookbackMinutes() != null
                ? configurationResolver.orcaPush().recoveryInitialLookbackMinutes()
                : 30;
        Instant windowStart = windowEnd.minusSeconds(lookbackMinutes * 60L);
        String recoveryRunId = "PUSHREC-" + facilityId + "-" + windowEnd.toEpochMilli();
        try {
            for (String event : enabledEvents()) {
                bootstrapCursor(facilityId, streamKind(event), recoveryRunId);
                if (!configurationResolver.orcaPush().recoveryUsePusheventget()) {
                    continue;
                }
                String payload = "{\"pusheventgetv2req\":{\"event\":\"" + event + "\"}}";
                String body = orcaTransport.invoke(
                        facilityId,
                        OrcaEndpoint.PUSH_EVENT_GET,
                        OrcaTransportRequest.post(payload).withAccept("application/json"))
                        .getBody();
                if (body != null && !body.isBlank()) {
                    router.route(facilityId, websocketUrl, body);
                }
            }
            metricsRegistrar.recordRecovery(facilityId, mode(), "success");
        } catch (RuntimeException ex) {
            LOGGER.log(Level.WARNING, "ORCA push recovery failed. facilityId=" + facilityId + " reason=" + reason, ex);
            connectionStateStore.markDegraded(facilityId, "recovery", websocketUrl, "recovery_failed");
            metricsRegistrar.recordRecovery(facilityId, mode(), "failed");
        }
    }

    private List<String> enabledEvents() {
        List<String> events = new ArrayList<>();
        if (configurationResolver.orcaPush().receptionEnabled()) {
            events.add("patient_accept");
        }
        if (configurationResolver.orcaPush().medicalEnabled()) {
            events.add("patient_account");
        }
        return events;
    }

    private void bootstrapCursor(String facilityId, String streamKind, String recoveryRunId) {
        if (cursorStore.load(facilityId, streamKind) == null) {
            cursorStore.save(facilityId, streamKind, null, null, null, null, recoveryRunId);
        }
    }

    private String streamKind(String event) {
        return switch (event) {
            case "patient_accept" -> ReceptionPushHandler.STREAM_KIND;
            case "patient_account" -> MedicalPushHandler.STREAM_KIND;
            default -> "unknown";
        };
    }

    private String mode() {
        return configurationResolver != null && configurationResolver.orcaPush().shadowMode() ? "shadow" : "live";
    }

    private static String requireFacilityId(String facilityId) {
        if (facilityId == null || facilityId.isBlank()) {
            throw new IllegalStateException("facilityId is required");
        }
        return facilityId.trim();
    }
}

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
    OrcaPushStateStore stateStore;

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
        if (configurationResolver == null || !configurationResolver.orcaPush().recoveryEnabled()) {
            return;
        }
        Instant windowEnd = Instant.now();
        int lookbackMinutes = configurationResolver.orcaPush().recoveryInitialLookbackMinutes() != null
                ? configurationResolver.orcaPush().recoveryInitialLookbackMinutes()
                : 30;
        Instant windowStart = windowEnd.minusSeconds(lookbackMinutes * 60L);
        stateStore.markRecoveryStarted(facilityId, windowStart, windowEnd);
        try {
            if (!configurationResolver.orcaPush().recoveryUsePusheventget()) {
                stateStore.markRecoveryFinished(facilityId, windowStart, windowEnd, null);
                return;
            }
            for (String event : enabledEvents()) {
                String payload = "{\"pusheventgetv2req\":{\"event\":\"" + event + "\"}}";
                String body = orcaTransport.invokeDetailed(
                        OrcaEndpoint.PUSH_EVENT_GET,
                        OrcaTransportRequest.post(payload).withAccept("application/json"))
                        .getBody();
                if (body != null && !body.isBlank()) {
                    router.route(facilityId, websocketUrl, body);
                }
            }
            stateStore.markRecoveryFinished(facilityId, windowStart, windowEnd, null);
            metricsRegistrar.recordRecovery(facilityId, mode(), "success");
        } catch (RuntimeException ex) {
            LOGGER.log(Level.WARNING, "ORCA push recovery failed. facilityId=" + facilityId + " reason=" + reason, ex);
            stateStore.markRecoveryFinished(facilityId, windowStart, windowEnd, "recovery_failed");
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

    private String mode() {
        return configurationResolver != null && configurationResolver.orcaPush().shadowMode() ? "shadow" : "live";
    }
}

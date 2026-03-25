package open.dolphin.orca.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.metrics.OrcaPushMetricsRegistrar;
import open.dolphin.orca.push.dto.OrcaPushEnvelope;
import open.dolphin.orca.push.dto.OrcaPushEventData;
import open.dolphin.rest.AbstractResource;
import open.dolphin.runtime.config.ServerConfigurationResolver;

@ApplicationScoped
public class OrcaPushEventRouter {

    private static final Logger LOGGER = Logger.getLogger(OrcaPushEventRouter.class.getName());

    private final ObjectMapper mapper = AbstractResource.getSerializeMapper();

    @Inject
    ReceptionPushHandler receptionPushHandler;

    @Inject
    MedicalPushHandler medicalPushHandler;

    @Inject
    OrcaPushConnectionStateStore connectionStateStore;

    @Inject
    OrcaPushMetricsRegistrar metricsRegistrar;

    @Inject
    ServerConfigurationResolver configurationResolver;

    public void route(String facilityId, String websocketUrl, String payload) {
        OrcaPushEnvelope envelope;
        try {
            envelope = mapper.readValue(payload, OrcaPushEnvelope.class);
        } catch (Exception ex) {
            LOGGER.log(Level.WARNING, "Ignoring invalid ORCA push payload. facilityId=" + facilityId, ex);
            metricsRegistrar.recordFailure(facilityId, "invalid_json", mode());
            return;
        }
        handle(facilityId, websocketUrl, envelope);
    }

    public void handle(String facilityId, String websocketUrl, OrcaPushEnvelope envelope) {
        if (envelope == null || envelope.getCommand() == null || envelope.getCommand().isBlank()) {
            metricsRegistrar.recordFailure(facilityId, "unknown_command", mode());
            return;
        }
        String command = envelope.getCommand().trim().toLowerCase(java.util.Locale.ROOT);
        switch (command) {
            case "subscribed" -> connectionStateStore.markConnected(facilityId, "push", websocketUrl);
            case "error" -> connectionStateStore.markDegraded(
                    facilityId,
                    "push",
                    websocketUrl,
                    envelope.getMessage() != null ? envelope.getMessage() : "push_command_error");
            case "unsubscribe" -> connectionStateStore.markDisconnected(facilityId, "push", websocketUrl, envelope.getMessage());
            case "event" -> routeEvent(facilityId, websocketUrl, envelope.getData());
            default -> LOGGER.log(Level.WARNING, "Ignoring unknown ORCA push command. facilityId={0} command={1}",
                    new Object[]{facilityId, envelope.getCommand()});
        }
    }

    private void routeEvent(String facilityId, String websocketUrl, OrcaPushEventData eventData) {
        if (eventData == null || eventData.getEvent() == null || eventData.getEvent().isBlank()) {
            metricsRegistrar.recordFailure(facilityId, "missing_event_name", mode());
            return;
        }
        String eventName = eventData.getEvent().trim();
        switch (eventName) {
            case "patient_accept" -> receptionPushHandler.handle(facilityId, eventData);
            case "patient_account" -> medicalPushHandler.handle(facilityId, eventData);
            default -> LOGGER.log(Level.WARNING, "Ignoring unknown ORCA push event. facilityId={0} event={1}",
                    new Object[]{facilityId, eventName});
        }
    }

    private String mode() {
        return configurationResolver != null && configurationResolver.orcaPush().shadowMode() ? "shadow" : "live";
    }
}

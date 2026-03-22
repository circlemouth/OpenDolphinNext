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
    OrcaPushStateStore stateStore;

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
            case "subscribed" -> stateStore.markConnected(facilityId, websocketUrl);
            case "error" -> stateStore.markDegraded(
                    facilityId,
                    websocketUrl,
                    envelope.getMessage() != null ? envelope.getMessage() : "push_command_error");
            case "unsubscribe" -> stateStore.markDisconnected(facilityId, websocketUrl, envelope.getMessage());
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
        stateStore.markEvent(facilityId, websocketUrl, eventData.getUuid(), eventData.getEvent(), parseInstant(eventData.getTime()));
        String eventName = eventData.getEvent().trim();
        switch (eventName) {
            case "patient_accept" -> receptionPushHandler.handle(facilityId, eventData);
            case "patient_account" -> medicalPushHandler.handle(facilityId, eventData);
            default -> LOGGER.log(Level.WARNING, "Ignoring unknown ORCA push event. facilityId={0} event={1}",
                    new Object[]{facilityId, eventName});
        }
    }

    private Instant parseInstant(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private String mode() {
        return configurationResolver != null && configurationResolver.orcaPush().shadowMode() ? "shadow" : "live";
    }
}

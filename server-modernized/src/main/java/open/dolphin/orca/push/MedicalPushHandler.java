package open.dolphin.orca.push;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.metrics.OrcaPushMetricsRegistrar;
import open.dolphin.orca.push.dto.OrcaPushBody;
import open.dolphin.orca.push.dto.OrcaPushEventData;
import open.dolphin.orca.push.dto.OrcaPushMedicalBody;
import open.dolphin.orca.push.dto.OrcaPushMedicalInformation;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.runtime.config.ServerConfigurationResolver;

@ApplicationScoped
public class MedicalPushHandler implements OrcaPushEventHandler {

    private static final Logger LOGGER = Logger.getLogger(MedicalPushHandler.class.getName());
    static final String STREAM_KIND = "medical";

    @Inject
    OrcaTransport orcaTransport;

    @Inject
    OrcaPushEventInboxStore eventInboxStore;

    @Inject
    OrcaPushConnectionStateStore connectionStateStore;

    @Inject
    OrcaPushMetricsRegistrar metricsRegistrar;

    @Inject
    ServerConfigurationResolver configurationResolver;

    @Override
    public void handle(String facilityId, OrcaPushEventData eventData) {
        facilityId = requireFacilityId(facilityId);
        OrcaPushMedicalBody body = asMedicalBody(eventData != null ? eventData.getBody() : null);
        if (body == null) {
            metricsRegistrar.recordFailure(facilityId, "patient_account", mode());
            return;
        }
        String eventUuid = normalize(eventData != null ? eventData.getUuid() : null);
        String eventName = normalize(eventData != null ? eventData.getEvent() : null);
        Instant eventTime = parseInstant(eventData != null ? eventData.getTime() : null);
        if (eventInboxStore.isApplied(facilityId, STREAM_KIND, eventUuid)) {
            metricsRegistrar.recordDuplicate(facilityId, eventName, mode());
            return;
        }
        eventInboxStore.markReceived(facilityId, STREAM_KIND, eventUuid, eventName, eventTime, "{}", null);
        List<OrcaPushMedicalInformation> items = body.getMedical_Information();
        if (items == null || items.isEmpty()) {
            LOGGER.log(Level.WARNING, "patient_account event has no invoice payload. facilityId={0}", facilityId);
            eventInboxStore.markFailed(facilityId, STREAM_KIND, eventUuid, Instant.now(),
                    "missing_invoice_payload", "patient_account event has no invoice payload", null);
            metricsRegistrar.recordFailure(facilityId, eventName, mode());
            return;
        }
        boolean anyFailure = false;
        for (OrcaPushMedicalInformation item : items) {
            try {
                String xml = buildMedicalGetPayload(body, item);
                orcaTransport.invoke(
                        facilityId,
                        OrcaEndpoint.MEDICAL_GET,
                        OrcaTransportRequest.post(xml).withQuery("class=02"));
            } catch (RuntimeException ex) {
                anyFailure = true;
                LOGGER.log(Level.WARNING, "patient_account invoice pull failed. facilityId=" + facilityId, ex);
            }
        }
        if (anyFailure) {
            eventInboxStore.markFailed(facilityId, STREAM_KIND, eventUuid, Instant.now(),
                    "medical_push_partial_failure", "One or more invoice pulls failed", null);
            connectionStateStore.markDegraded(facilityId, STREAM_KIND, null, "medical_push_partial_failure");
            metricsRegistrar.recordFailure(facilityId, eventName, mode());
        } else {
            eventInboxStore.markFetched(facilityId, STREAM_KIND, eventUuid, Instant.now(), null);
            eventInboxStore.markApplied(facilityId, STREAM_KIND, eventUuid, Instant.now(), null);
            metricsRegistrar.recordReceived(facilityId, eventName, mode());
        }
    }

    String buildMedicalGetPayload(OrcaPushMedicalBody body, OrcaPushMedicalInformation item) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data><medicalgetreq type=\"record\">");
        builder.append("<Request_Number type=\"string\">01</Request_Number>");
        append(builder, "InOut", "O");
        append(builder, "Patient_ID", body.getPatient_ID());
        append(builder, "Perform_Date", body.getPerform_Date());
        builder.append("<Medical_Information type=\"record\">");
        append(builder, "Department_Code", item.getDepartment_Code());
        append(builder, "Insurance_Combination_Number", item.getInsurance_Combination_Number());
        if (item.getInvoice_Number() != null && !item.getInvoice_Number().isBlank()) {
            append(builder, "Invoice_Number", item.getInvoice_Number());
        } else {
            append(builder, "Sequential_Number", "1");
        }
        builder.append("</Medical_Information>");
        builder.append("</medicalgetreq></data>");
        return builder.toString();
    }

    private void append(StringBuilder builder, String tag, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        builder.append('<').append(tag).append(" type=\"string\">")
                .append(value)
                .append("</").append(tag).append('>');
    }

    private OrcaPushMedicalBody asMedicalBody(OrcaPushBody body) {
        return body instanceof OrcaPushMedicalBody medicalBody ? medicalBody : null;
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

    private int dedupRetentionDays() {
        return configurationResolver != null && configurationResolver.orcaPush().dedupRetentionDays() != null
                ? configurationResolver.orcaPush().dedupRetentionDays()
                : 14;
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

    private static String normalize(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        return value.trim();
    }
}

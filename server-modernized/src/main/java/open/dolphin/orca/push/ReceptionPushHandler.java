package open.dolphin.orca.push;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.metrics.OrcaPushMetricsRegistrar;
import open.dolphin.orca.push.dto.OrcaPushBody;
import open.dolphin.orca.push.dto.OrcaPushEventData;
import open.dolphin.orca.push.dto.OrcaPushReceptionBody;
import open.dolphin.orca.service.OrcaWrapperService;
import open.dolphin.rest.ReceptionRealtimeSseSupport;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import open.dolphin.rest.dto.orca.VisitMutationResponse;
import open.dolphin.runtime.config.ServerConfigurationResolver;

@ApplicationScoped
public class ReceptionPushHandler implements OrcaPushEventHandler {

    private static final Logger LOGGER = Logger.getLogger(ReceptionPushHandler.class.getName());
    private static final long[] RETRY_BACKOFF_MILLIS = {250L, 500L, 1000L};

    @Inject
    OrcaWrapperService wrapperService;

    @Inject
    ReceptionRealtimeSseSupport realtimeSseSupport;

    @Inject
    ServerConfigurationResolver configurationResolver;

    @Inject
    OrcaPushSeenEventStore seenEventStore;

    @Inject
    OrcaPushMetricsRegistrar metricsRegistrar;

    @Override
    public void handle(String facilityId, OrcaPushEventData eventData) {
        OrcaPushReceptionBody body = asReceptionBody(eventData != null ? eventData.getBody() : null);
        if (body == null) {
            metricsRegistrar.recordFailure(facilityId, "patient_accept", mode());
            return;
        }
        Instant eventTime = parseInstant(eventData.getTime());
        if (!seenEventStore.markSeen(
                facilityId,
                eventData.getUuid(),
                eventData.getEvent(),
                eventTime,
                dedupRetentionDays())) {
            metricsRegistrar.recordDuplicate(facilityId, eventData.getEvent(), mode());
            return;
        }

        String patientMode = normalizeMode(body.getPatient_Mode());
        if (patientMode == null) {
            LOGGER.log(Level.WARNING, "Unexpected patient_accept mode. facilityId={0} mode={1}",
                    new Object[]{facilityId, body.getPatient_Mode()});
            metricsRegistrar.recordFailure(facilityId, eventData.getEvent(), mode());
            return;
        }
        String requestNumber = switch (patientMode) {
            case "add" -> "01";
            case "modify" -> "03";
            case "delete" -> "02";
            default -> null;
        };
        if ("delete".equals(patientMode)) {
            if (isBlank(body.getPatient_ID()) || isBlank(body.getAccept_Date())) {
                realtimeSseSupport.publishReplayGap(facilityId);
                metricsRegistrar.recordFailure(facilityId, eventData.getEvent(), mode());
                return;
            }
            realtimeSseSupport.publishReceptionUpdate(
                    facilityId,
                    body.getAccept_Date(),
                    body.getPatient_ID(),
                    requestNumber,
                    null);
            metricsRegistrar.recordReceived(facilityId, eventData.getEvent(), mode());
            return;
        }

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber("00");
        request.setPatientId(body.getPatient_ID());
        request.setAcceptanceDate(body.getAccept_Date());
        request.setAcceptanceId(body.getAccept_Id());
        if (isBlank(body.getAccept_Id())) {
            request.setAcceptanceTime(body.getAccept_Time());
            request.setDepartmentCode(body.getDepartment_Code());
            request.setPhysicianCode(body.getPhysician_Code());
        }
        if (!isBlank(body.getInsurance_Combination_Number())) {
            VisitMutationRequest.InsuranceInformation insurance = new VisitMutationRequest.InsuranceInformation();
            insurance.setInsuranceCombinationNumber(body.getInsurance_Combination_Number());
            request.getInsurances().add(insurance);
        }

        VisitMutationResponse response = retryQuery(request);
        if (response == null || !isSuccess(response) || isBlank(response.getAcceptanceDate())) {
            realtimeSseSupport.publishReplayGap(facilityId);
            metricsRegistrar.recordFailure(facilityId, eventData.getEvent(), mode());
            return;
        }
        realtimeSseSupport.publishReceptionUpdate(
                facilityId,
                response.getAcceptanceDate(),
                request.getPatientId(),
                requestNumber,
                response.getRunId());
        metricsRegistrar.recordReceived(facilityId, eventData.getEvent(), mode());
    }

    private VisitMutationResponse retryQuery(VisitMutationRequest request) {
        for (int attempt = 0; attempt <= RETRY_BACKOFF_MILLIS.length; attempt++) {
            try {
                VisitMutationResponse response = wrapperService.mutateVisit(request);
                if (response != null && isSuccess(response)) {
                    return response;
                }
            } catch (RuntimeException ex) {
                LOGGER.log(Level.FINE, "Reception push pull failed", ex);
            }
            if (attempt < RETRY_BACKOFF_MILLIS.length) {
                try {
                    Thread.sleep(RETRY_BACKOFF_MILLIS[attempt]);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    return null;
                }
            }
        }
        return null;
    }

    private boolean isSuccess(VisitMutationResponse response) {
        return response != null
                && response.getApiResult() != null
                && response.getApiResult().matches("0+");
    }

    private OrcaPushReceptionBody asReceptionBody(OrcaPushBody body) {
        return body instanceof OrcaPushReceptionBody receptionBody ? receptionBody : null;
    }

    private String normalizeMode(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toLowerCase(java.util.Locale.ROOT);
        return switch (normalized) {
            case "add", "modify", "delete" -> normalized;
            default -> null;
        };
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

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}

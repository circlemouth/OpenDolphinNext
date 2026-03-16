package open.dolphin.security.audit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import org.junit.jupiter.api.Test;

class SessionAuditDispatcherTest {

    @Test
    void recordPropagatesOperationToEnvelope() {
        RecordingDispatcher dispatcher = new RecordingDispatcher();

        AuditEventPayload payload = new AuditEventPayload();
        payload.setActorId("F001:doctor01");
        payload.setAction("ORCA_APPOINTMENT_OUTPATIENT");
        payload.setResource("/api/orca/appointments/list");
        payload.setTraceId("trace-op");
        payload.setRequestId("req-op");
        payload.setDetails(Map.of("operation", "appointment_list"));

        AuditEventEnvelope envelope = dispatcher.record(payload, AuditEventEnvelope.Outcome.SUCCESS, null, null);

        assertNotNull(envelope);
        assertEquals("appointment_list", envelope.getOperation());
    }

    @Test
    void recordNormalizesMissingOutcome() {
        RecordingDispatcher dispatcher = new RecordingDispatcher();

        AuditEventPayload payload = new AuditEventPayload();
        payload.setActorId("F001:doctor01");
        payload.setAction("ORCA_CLAIM_OUTPATIENT");
        payload.setResource("/api/orca/chart-support/medical-mod-v2");
        payload.setTraceId("trace-missing");
        payload.setRequestId("req-missing");
        payload.setDetails(Map.of("outcome", "MISSING"));

        AuditEventEnvelope envelope = dispatcher.record(payload, AuditEventEnvelope.Outcome.SUCCESS, null, null);

        assertNotNull(envelope);
        assertEquals(AuditEventEnvelope.Outcome.MISSING, envelope.getOutcome());
    }

    @Test
    void recordDoesNotBackfillPatientIdFromDetails() {
        RecordingDispatcher dispatcher = new RecordingDispatcher();

        AuditEventPayload payload = new AuditEventPayload();
        payload.setActorId("F001:doctor01");
        payload.setAction("KARTE_DOCUMENT_DELETE");
        payload.setResource("/karte/document");
        payload.setTraceId("trace-patient");
        payload.setRequestId("req-patient");
        payload.setDetails(Map.of("patientId", "P0001"));

        AuditEventEnvelope envelope = dispatcher.record(payload, AuditEventEnvelope.Outcome.SUCCESS, null, null);

        assertNotNull(envelope);
        assertEquals(null, envelope.getPatientId());
        assertEquals(null, envelope.getDetails().get("patientId"));
    }

    @Test
    void recordDropsUnallowlistedSensitiveDetails() {
        RecordingDispatcher dispatcher = new RecordingDispatcher();

        AuditEventPayload payload = new AuditEventPayload();
        payload.setActorId("F001:doctor01");
        payload.setAction("PATIENT_READ");
        payload.setResource("/patient");
        payload.setTraceId("trace-token");
        payload.setRequestId("req-token");
        payload.setDetails(Map.of(
                "consentToken", "raw-token",
                "tokenPresent", Boolean.TRUE,
                "tokenHash", "abc123"));

        AuditEventEnvelope envelope = dispatcher.record(payload, AuditEventEnvelope.Outcome.SUCCESS, null, null);

        assertNotNull(envelope);
        assertEquals(null, envelope.getDetails().get("consentToken"));
        assertEquals("abc123", envelope.getDetails().get("tokenHash"));
    }

    private static final class RecordingDispatcher extends SessionAuditDispatcher {
        @Override
        public AuditEventEnvelope dispatch(AuditEventEnvelope envelope) {
            return envelope;
        }
    }
}

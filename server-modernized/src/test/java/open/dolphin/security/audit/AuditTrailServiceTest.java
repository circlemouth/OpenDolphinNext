package open.dolphin.security.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class AuditTrailServiceTest {

    @Test
    void recordUsesAuthoritativeAppendAndSanitizesPayload() throws Exception {
        AuditTrailService service = new AuditTrailService();
        AuthoritativeAuditRepository repository = mock(AuthoritativeAuditRepository.class);
        setField(service, "authoritativeAuditRepository", repository);
        setField(service, "auditHashService", new AuditHashService());
        when(repository.append(any())).thenReturn(new AuthoritativeAuditRepository.AuditWriteResult(
                10L,
                "payload-hash",
                "event-hash",
                9L,
                "prev-hash"));

        AuditEventPayload payload = new AuditEventPayload();
        payload.setActorId("F001:doctor01");
        payload.setActorDisplayName("doctor01");
        payload.setAction("PATIENT_READ");
        payload.setResource("/patient");
        payload.setTraceId("trace-audit");
        payload.setRequestId("req-audit");
        payload.setOutcome("SUCCESS");
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("patientId", "P0001");
        details.put("consentToken", "raw-consent-token");
        details.put("tokenHash", "hash-value");
        payload.setDetails(details);

        open.dolphin.infomodel.AuditEvent event = service.record(payload);

        ArgumentCaptor<AuthoritativeAuditRepository.AuditWriteCommand> captor =
                ArgumentCaptor.forClass(AuthoritativeAuditRepository.AuditWriteCommand.class);
        verify(repository).append(captor.capture());
        assertThat(captor.getValue().subjectType()).isEqualTo("patient");
        assertThat(captor.getValue().subjectId()).isEqualTo("P0001");
        assertThat(captor.getValue().payload()).doesNotContainKey("patientId").doesNotContainKey("consentToken");
        assertThat(captor.getValue().payload()).containsEntry("tokenHash", "hash-value");
        assertThat(event.getPayloadHash()).isEqualTo("payload-hash");
        assertThat(event.getEventHash()).isEqualTo("event-hash");
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = null;
        Class<?> type = target.getClass();
        while (type != null && field == null) {
            try {
                field = type.getDeclaredField(fieldName);
            } catch (NoSuchFieldException ex) {
                type = type.getSuperclass();
            }
        }
        if (field == null) {
            throw new NoSuchFieldException(fieldName);
        }
        field.setAccessible(true);
        field.set(target, value);
    }
}

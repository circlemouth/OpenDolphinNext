package open.dolphin.security.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import org.junit.jupiter.api.Test;

class SessionAuditDispatcherTest {

    @Test
    void dispatchDelegatesToAuditTrailServiceWithoutDirectJmsPublish() throws Exception {
        SessionAuditDispatcher dispatcher = new SessionAuditDispatcher();
        AuditTrailService auditTrailService = mock(AuditTrailService.class);
        setField(dispatcher, "auditTrailService", auditTrailService);

        AuditEventEnvelope envelope = AuditEventEnvelope.builder("ORCA_APPOINTMENT_OUTPATIENT", "/api/orca/official/appointments/list")
                .actorId("F001:doctor01")
                .requestId("req-op")
                .traceId("trace-op")
                .details(Map.of("operation", "appointment_list"))
                .build();
        when(auditTrailService.write(envelope)).thenReturn(envelope);

        AuditEventEnvelope persisted = dispatcher.dispatch(envelope);

        assertThat(persisted).isSameAs(envelope);
        verify(auditTrailService).write(envelope);
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

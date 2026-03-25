package open.dolphin.security.audit;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.List;
import open.dolphin.audit.AuditEventEnvelope;
import org.junit.jupiter.api.Test;

class AuditOutboxDispatcherTest {

    @Test
    void dispatchPendingMarksSentOnSuccessAndFailedOnError() throws Exception {
        AuditOutboxRepository outboxRepository = mock(AuditOutboxRepository.class);
        AuditOutboxDispatcher dispatcher = spy(new AuditOutboxDispatcher());
        setField(dispatcher, "auditOutboxRepository", outboxRepository);
        setField(dispatcher, "authoritativeAuditRepository", mock(AuthoritativeAuditRepository.class));

        AuditOutboxRepository.OutboxRow success =
                new AuditOutboxRepository.OutboxRow(1L, AuditOutboxRepository.DESTINATION_JMS_DOLPHIN, "claimed", Instant.now(), 1, null);
        AuditOutboxRepository.OutboxRow failure =
                new AuditOutboxRepository.OutboxRow(2L, AuditOutboxRepository.DESTINATION_JMS_DOLPHIN, "claimed", Instant.now(), 1, null);
        when(outboxRepository.claimPending(eq(AuditOutboxRepository.DESTINATION_JMS_DOLPHIN), eq(100), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of(success, failure));
        doThrow(new IllegalStateException("boom")).when(dispatcher).buildEnvelope(2L);
        org.mockito.Mockito.doReturn(AuditEventEnvelope.builder("ACTION", "/api").requestId("req").traceId("trace").build())
                .when(dispatcher).buildEnvelope(1L);
        org.mockito.Mockito.doNothing().when(dispatcher).publishToJms(org.mockito.ArgumentMatchers.any());

        dispatcher.dispatchPending();

        verify(outboxRepository).markDelivered(eq(1L), eq(AuditOutboxRepository.DESTINATION_JMS_DOLPHIN), org.mockito.ArgumentMatchers.any());
        verify(outboxRepository).markFailed(eq(2L), eq(AuditOutboxRepository.DESTINATION_JMS_DOLPHIN), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

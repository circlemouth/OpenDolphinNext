package open.dolphin.security.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;

class AuthoritativeAuditRepositoryManagedTransactionTest {

    @Test
    void appendDoesNotToggleAutoCommitInsideManagedTransaction() throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        PreparedStatement lockStatement = mock(PreparedStatement.class);
        PreparedStatement insertStatement = mock(PreparedStatement.class);
        PreparedStatement updateStatement = mock(PreparedStatement.class);
        ResultSet lockResult = mock(ResultSet.class);
        ResultSet insertResult = mock(ResultSet.class);
        AuditOutboxRepository outboxRepository = mock(AuditOutboxRepository.class);

        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.getAutoCommit()).thenReturn(false);
        when(connection.prepareStatement(any(String.class)))
                .thenReturn(lockStatement, insertStatement, updateStatement);

        when(lockStatement.executeQuery()).thenReturn(lockResult);
        when(lockResult.next()).thenReturn(true);
        when(lockResult.getObject(1)).thenReturn(null);
        when(lockResult.getString(2)).thenReturn(null);

        when(insertStatement.executeQuery()).thenReturn(insertResult);
        when(insertResult.next()).thenReturn(true);
        when(insertResult.getLong(1)).thenReturn(123L);

        doNothing().when(outboxRepository).enqueue(any(Connection.class), anyLong(), eq(AuditOutboxRepository.DESTINATION_JMS_DOLPHIN));

        AuthoritativeAuditRepository repository = new AuthoritativeAuditRepository();
        setField(repository, "dataSource", dataSource);
        setField(repository, "auditHashService", new AuditHashService());
        setField(repository, "auditOutboxRepository", outboxRepository);

        AuthoritativeAuditRepository.AuditWriteResult result = repository.append(new AuthoritativeAuditRepository.AuditWriteCommand(
                Instant.parse("2026-03-26T07:00:00Z"),
                "SESSION_LOGIN",
                "/api/session/login",
                "actor",
                "ADMIN",
                "F001",
                "user",
                "U001",
                "SUCCESS",
                200,
                "trace-1",
                "request-1",
                "127.0.0.1",
                "ua",
                Map.of("result", "ok")));

        assertThat(result.eventId()).isEqualTo(123L);
        verify(connection, never()).setAutoCommit(true);
        verify(connection, never()).setAutoCommit(false);
        verify(connection, never()).commit();
        verify(connection, never()).rollback();
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

package open.dolphin.security.audit;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.Map;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class AuthoritativeAuditRepositoryTest {

    @Test
    void appendBuildsHashChainAndSanitizesPayload() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            AuditHashService hashService = new AuditHashService();
            AuditOutboxRepository outboxRepository = new AuditOutboxRepository();
            setField(outboxRepository, "dataSource", dataSource);
            AuthoritativeAuditRepository repository = new AuthoritativeAuditRepository();
            setField(repository, "dataSource", dataSource);
            setField(repository, "auditHashService", hashService);
            setField(repository, "auditOutboxRepository", outboxRepository);

            AuthoritativeAuditRepository.AuditWriteResult first = repository.append(new AuthoritativeAuditRepository.AuditWriteCommand(
                    Instant.parse("2026-03-25T12:00:00Z"),
                    "SESSION_LOGIN",
                    "/api/session/login",
                    "FACILITY:admin",
                    "ADMIN",
                    "F001",
                    "user",
                    "501",
                    "SUCCESS",
                    200,
                    "trace-1",
                    "req-1",
                    "203.0.113.10",
                    "Mozilla/5.0",
                    Map.of("patientId", "P001", "totpCode", "123456")));
            AuthoritativeAuditRepository.AuditWriteResult second = repository.append(new AuthoritativeAuditRepository.AuditWriteCommand(
                    Instant.parse("2026-03-25T12:01:00Z"),
                    "SESSION_REVOKE",
                    "/api/session/revoke",
                    "FACILITY:admin",
                    "ADMIN",
                    "F001",
                    "user",
                    "501",
                    "SUCCESS",
                    204,
                    "trace-2",
                    "req-2",
                    "203.0.113.10",
                    "Mozilla/5.0",
                    Map.of("reason", "password_reset")));

            assertThat(first.previousEventId()).isNull();
            assertThat(first.previousHash()).isNull();
            assertThat(second.previousEventId()).isEqualTo(first.eventId());
            assertThat(second.previousHash()).isEqualTo(first.eventHash());

            try (Connection connection = dataSource.getConnection();
                 var statement = connection.prepareStatement(
                         "select payload_json::text, payload_hash, previous_event_id, previous_hash, event_hash, user_agent_hash "
                                 + "from opendolphin.audit_event where event_id = ?")) {
                statement.setLong(1, first.eventId());
                try (ResultSet resultSet = statement.executeQuery()) {
                    assertThat(resultSet.next()).isTrue();
                    String payloadJson = resultSet.getString(1);
                    assertThat(payloadJson).isEqualTo("{}");
                    assertThat(resultSet.getString(2)).isEqualTo(first.payloadHash());
                    assertThat(resultSet.getObject(3)).isNull();
                    assertThat(resultSet.getString(4)).isNull();
                    assertThat(resultSet.getString(5)).isEqualTo(first.eventHash());
                    assertThat(resultSet.getString(6)).hasSize(64);
                }
            }

            try (Connection connection = dataSource.getConnection();
                 var statement = connection.prepareStatement(
                         "select head_event_id, head_hash from opendolphin.audit_chain_head where singleton_key = 1")) {
                try (ResultSet resultSet = statement.executeQuery()) {
                    assertThat(resultSet.next()).isTrue();
                    assertThat(resultSet.getLong(1)).isEqualTo(second.eventId());
                    assertThat(resultSet.getString(2)).isEqualTo(second.eventHash());
                }
            }
        }
    }

    private static void migrate(DataSource dataSource) {
        Flyway.configure()
                .dataSource(dataSource)
                .defaultSchema("opendolphin")
                .schemas("opendolphin")
                .locations("classpath:db/migration")
                .load()
                .migrate();
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

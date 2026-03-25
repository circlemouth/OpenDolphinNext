package open.dolphin.security.audit;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.List;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class AuditOutboxRepositoryTest {

    @Test
    void enqueueClaimAndDeliveryStateTransitionsArePersisted() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            AuditHashService hashService = new AuditHashService();
            AuditOutboxRepository repository = new AuditOutboxRepository();
            setField(repository, "dataSource", dataSource);
            AuthoritativeAuditRepository auditRepository = new AuthoritativeAuditRepository();
            setField(auditRepository, "dataSource", dataSource);
            setField(auditRepository, "auditHashService", hashService);
            setField(auditRepository, "auditOutboxRepository", repository);
            long eventId = auditRepository.append(new AuthoritativeAuditRepository.AuditWriteCommand(
                    Instant.parse("2026-03-25T13:00:00Z"),
                    "AUDIT_EXPORT",
                    "/internal/audit/export",
                    "system",
                    "SYSTEM",
                    "F001",
                    "facility",
                    "F001",
                    "SUCCESS",
                    202,
                    "trace-export",
                    "req-export",
                    "127.0.0.1",
                    "outbox-test",
                    java.util.Map.of("destination", "siem"))).eventId();

            repository.enqueue(eventId, "siem");
            List<AuditOutboxRepository.OutboxRow> claimed =
                    repository.claimPending("siem", 10, Instant.parse("2026-03-25T13:01:00Z"));
            assertThat(claimed).hasSize(1);
            assertThat(claimed.get(0).deliveryState()).isEqualTo("claimed");
            assertThat(claimed.get(0).attemptCount()).isEqualTo(1);
            assertThat(claimed.get(0).lastAttemptAt()).isEqualTo(Instant.parse("2026-03-25T13:01:00Z"));

            repository.markFailed(eventId, "siem", Instant.parse("2026-03-25T13:02:00Z"), "network");
            List<AuditOutboxRepository.OutboxRow> retried =
                    repository.claimPending("siem", 10, Instant.parse("2026-03-25T13:03:00Z"));
            assertThat(retried).hasSize(1);
            assertThat(retried.get(0).deliveryState()).isEqualTo("claimed");
            assertThat(retried.get(0).attemptCount()).isEqualTo(2);

            repository.markDelivered(eventId, "siem", Instant.parse("2026-03-25T13:04:00Z"));
            assertThat(repository.claimPending("siem", 10, Instant.parse("2026-03-25T13:05:00Z"))).isEmpty();
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

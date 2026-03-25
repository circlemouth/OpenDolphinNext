package open.dolphin.security.audit;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class AuditChainVerifierTest {

    @Test
    void verifierRecomputesHashesAndDetectsTampering() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            AuditHashService hashService = new AuditHashService();
            AuditOutboxRepository outboxRepository = new AuditOutboxRepository();
            AuthoritativeAuditRepository repository = new AuthoritativeAuditRepository();
            setField(outboxRepository, "dataSource", dataSource);
            setField(repository, "dataSource", dataSource);
            setField(repository, "auditHashService", hashService);
            setField(repository, "auditOutboxRepository", outboxRepository);

            repository.append(new AuthoritativeAuditRepository.AuditWriteCommand(
                    java.time.Instant.parse("2026-03-25T12:00:00Z"),
                    "ACTION_ONE",
                    "/api/one",
                    "actor",
                    "ADMIN",
                    "F001",
                    "patient",
                    "P1",
                    "SUCCESS",
                    200,
                    "trace-1",
                    "req-1",
                    "127.0.0.1",
                    "ua",
                    java.util.Map.of("tokenHash", "abc")));
            repository.append(new AuthoritativeAuditRepository.AuditWriteCommand(
                    java.time.Instant.parse("2026-03-25T12:01:00Z"),
                    "ACTION_TWO",
                    "/api/two",
                    "actor",
                    "ADMIN",
                    "F001",
                    "patient",
                    "P2",
                    "SUCCESS",
                    200,
                    "trace-2",
                    "req-2",
                    "127.0.0.1",
                    "ua",
                    java.util.Map.of("tokenHash", "def")));

            AuditChainVerifier verifier = new AuditChainVerifier();
            setField(verifier, "authoritativeAuditRepository", repository);
            setField(verifier, "auditHashService", hashService);

            assertThat(verifier.verifyAll().valid()).isTrue();

            try (Connection connection = dataSource.getConnection();
                 var statement = connection.prepareStatement("update opendolphin.audit_event set payload_json = cast('{\"tokenHash\":\"tampered\"}' as jsonb) where event_id = 2")) {
                statement.executeUpdate();
            }

            AuditChainVerifier.VerificationResult result = verifier.verifyAll();
            assertThat(result.valid()).isFalse();
            assertThat(result.errors()).anyMatch(error -> error.contains("payload_hash mismatch"));
        }
    }

    @Test
    void concurrentAppendsRemainLinearWithoutChainFork() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            AuditHashService hashService = new AuditHashService();
            AuditOutboxRepository outboxRepository = new AuditOutboxRepository();
            AuthoritativeAuditRepository repository = new AuthoritativeAuditRepository();
            setField(outboxRepository, "dataSource", dataSource);
            setField(repository, "dataSource", dataSource);
            setField(repository, "auditHashService", hashService);
            setField(repository, "auditOutboxRepository", outboxRepository);

            var executor = Executors.newFixedThreadPool(4);
            try {
                List<Callable<Long>> tasks = new ArrayList<>();
                for (int i = 0; i < 8; i++) {
                    final int index = i;
                    tasks.add(() -> repository.append(new AuthoritativeAuditRepository.AuditWriteCommand(
                            java.time.Instant.parse("2026-03-25T12:10:0" + index + "Z"),
                            "ACTION_" + index,
                            "/api/" + index,
                            "actor",
                            "ADMIN",
                            "F001",
                            "patient",
                            "P" + index,
                            "SUCCESS",
                            200,
                            "trace-" + index,
                            "req-" + index,
                            "127.0.0.1",
                            "ua",
                            java.util.Map.of("tokenHash", Integer.toString(index)))).eventId());
                }
                var futures = executor.invokeAll(tasks);
                for (var future : futures) {
                    assertThat(future.get(5, TimeUnit.SECONDS)).isPositive();
                }
            } finally {
                executor.shutdownNow();
            }

            AuditChainVerifier verifier = new AuditChainVerifier();
            setField(verifier, "authoritativeAuditRepository", repository);
            setField(verifier, "auditHashService", hashService);
            AuditChainVerifier.VerificationResult result = verifier.verifyAll();
            assertThat(result.valid()).isTrue();
            assertThat(result.verifiedEvents()).isEqualTo(8);
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

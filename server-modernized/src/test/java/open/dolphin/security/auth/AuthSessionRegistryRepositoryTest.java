package open.dolphin.security.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Optional;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class AuthSessionRegistryRepositoryTest {

    @Test
    void sessionLifecyclePersistsStepUpAndRevocationState() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            AuthSessionRegistryRepository repository = new AuthSessionRegistryRepository();
            setField(repository, "dataSource", dataSource);

            Instant issuedAt = Instant.parse("2026-03-25T10:00:00Z");
            repository.upsertAuthenticatedSession(
                    "sess-1",
                    501L,
                    "FACILITY:admin",
                    "F001",
                    "client-1",
                    "password",
                    issuedAt,
                    issuedAt,
                    4L,
                    7L);

            repository.touchLastSeen("sess-1", Instant.parse("2026-03-25T10:01:00Z"));
            repository.saveStepUp(
                    "sess-1",
                    "admin:mutation",
                    Instant.parse("2026-03-25T10:02:00Z"),
                    Instant.parse("2026-03-25T10:12:00Z"));

            Optional<AuthSessionRegistryRepository.SessionRow> row = repository.findBySessionId("sess-1");
            assertThat(row).isPresent();
            assertThat(row.orElseThrow().lastSeenAt()).isEqualTo(Instant.parse("2026-03-25T10:01:00Z"));
            assertThat(row.orElseThrow().stepUpScope()).isEqualTo("admin:mutation");
            assertThat(row.orElseThrow().stepUpExpiresAt()).isEqualTo(Instant.parse("2026-03-25T10:12:00Z"));

            repository.upsertAuthenticatedSession(
                    "sess-2",
                    501L,
                    "FACILITY:admin",
                    "F001",
                    "client-2",
                    "password",
                    issuedAt,
                    issuedAt,
                    4L,
                    7L);
            int revoked = repository.revokeAllActiveSessions(
                    501L,
                    "password_reset",
                    Instant.parse("2026-03-25T11:00:00Z"));
            assertThat(revoked).isEqualTo(2);
            assertThat(repository.findBySessionId("sess-1").orElseThrow().revocationReason()).isEqualTo("password_reset");

            repository.upsertAuthenticatedSession(
                    "sess-legacy",
                    502L,
                    "FACILITY:admin",
                    "F001",
                    "client-3",
                    "password",
                    issuedAt,
                    issuedAt,
                    0L,
                    0L);
            repository.revokeSession("sess-legacy", "manual", Instant.parse("2026-03-20T10:00:00Z"));
            repository.purgeRevokedOlderThan(Instant.parse("2026-03-21T00:00:00Z"));

            assertThat(repository.findBySessionId("sess-legacy")).isEmpty();
            assertThat(repository.findBySessionId("sess-2")).isPresent();
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

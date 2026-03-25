package open.dolphin.security.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.ResultSet;
import java.time.Instant;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class UserSecurityStateRepositoryTest {

    @Test
    void ensureAndEpochMutationsPersistDurableSecurityState() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            UserSecurityStateRepository repository = new UserSecurityStateRepository();
            setField(repository, "dataSource", dataSource);

            repository.ensureRow(101L);
            assertThat(repository.currentCredentialEpoch(101L)).isZero();
            assertThat(repository.currentSessionEpoch(101L)).isZero();

            repository.incrementCredentialEpoch(101L, Instant.parse("2026-03-25T10:00:00Z"));
            repository.incrementSessionEpoch(101L, Instant.parse("2026-03-25T10:05:00Z"));
            repository.markPasswordChanged(101L, Instant.parse("2026-03-25T10:10:00Z"));

            assertThat(repository.currentCredentialEpoch(101L)).isEqualTo(1L);
            assertThat(repository.currentSessionEpoch(101L)).isEqualTo(1L);

            try (Connection connection = dataSource.getConnection();
                 var statement = connection.prepareStatement(
                         "select password_changed_at, factor2_required from opendolphin.user_security_state where user_pk = ?")) {
                statement.setLong(1, 101L);
                try (ResultSet resultSet = statement.executeQuery()) {
                    assertThat(resultSet.next()).isTrue();
                    assertThat(resultSet.getTimestamp(1).toInstant()).isEqualTo(Instant.parse("2026-03-25T10:10:00Z"));
                    assertThat(resultSet.getBoolean(2)).isTrue();
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

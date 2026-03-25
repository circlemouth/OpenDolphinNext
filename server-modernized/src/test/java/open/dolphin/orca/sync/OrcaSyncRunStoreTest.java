package open.dolphin.orca.sync;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.lang.reflect.Field;
import java.time.Instant;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class OrcaSyncRunStoreTest {

    @Test
    void runLifecyclePersistsRequestedFetchingApplyingAndTerminalStates() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaSyncRunStore store = new OrcaSyncRunStore();
            setField(store, "dataSource", dataSource);

            store.createRequested("run-1", "F001", "patient", "scheduled", Instant.parse("2026-03-25T10:00:00Z"), 12);
            store.markFetching("run-1", 12, Instant.parse("2026-03-25T10:01:00Z"));
            store.markApplying("run-1", 12, 10);
            store.markPartial("run-1", 12, Instant.parse("2026-03-25T10:03:00Z"), 10, 8, 1, 1, "partial_apply", "one failed");

            OrcaSyncRunStore.RunRow partial = store.load("run-1");
            assertThat(partial).isNotNull();
            assertThat(partial.requestedCount()).isEqualTo(12);
            assertThat(partial.status()).isEqualTo("partial");
            assertThat(partial.fetchedCount()).isEqualTo(10);
            assertThat(partial.appliedCount()).isEqualTo(8);
            assertThat(partial.failedCount()).isEqualTo(1);
            assertThat(partial.skippedCount()).isEqualTo(1);
            assertThat(partial.errorCode()).isEqualTo("partial_apply");

            store.createRequested("run-2", "F001", "patient", "manual", Instant.parse("2026-03-25T11:00:00Z"), 4);
            store.markCompleted("run-2", 4, Instant.parse("2026-03-25T11:05:00Z"), 4, 4, 0);
            assertThat(store.load("run-2").status()).isEqualTo("completed");

            store.createRequested("run-3", "F001", "patient", "manual", Instant.parse("2026-03-25T12:00:00Z"), 2);
            store.markFailed("run-3", 2, Instant.parse("2026-03-25T12:05:00Z"), 2, 2, "upstream_timeout", "ORCA timeout");
            OrcaSyncRunStore.RunRow failed = store.load("run-3");
            assertThat(failed.status()).isEqualTo("failed");
            assertThat(failed.failedCount()).isEqualTo(2);
            assertThat(failed.errorCode()).isEqualTo("upstream_timeout");
            assertThat(store.findLatest("F001", "patient").runId()).isEqualTo("run-3");
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

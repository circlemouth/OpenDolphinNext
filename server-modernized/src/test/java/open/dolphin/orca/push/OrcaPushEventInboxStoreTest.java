package open.dolphin.orca.push;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.List;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class OrcaPushEventInboxStoreTest {

    @Test
    void inboxLifecyclePersistsReceivedFetchedAppliedAndFailedEvents() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaPushEventInboxStore store = new OrcaPushEventInboxStore();
            setField(store, "dataSource", dataSource);

            store.markReceived("F001", "reception", "event-1", "acceptance", Instant.parse("2026-03-25T10:00:00Z"),
                    "{\"seq\":1}", "recovery-1");
            store.markFetched("F001", "reception", "event-1", Instant.parse("2026-03-25T10:01:00Z"), "recovery-1");
            store.markApplied("F001", "reception", "event-1", Instant.parse("2026-03-25T10:02:00Z"), "recovery-2");

            List<OrcaPushEventInboxStore.EventInboxRow> applied = store.findApplied("F001", "reception");
            assertThat(applied).hasSize(1);
            assertThat(applied.get(0).eventUuid()).isEqualTo("event-1");
            assertThat(applied.get(0).status()).isEqualTo("applied");
            assertThat(applied.get(0).lastRecoveryRunId()).isEqualTo("recovery-2");

            store.markReceived("F001", "reception", "event-2", "acceptance", Instant.parse("2026-03-25T11:00:00Z"),
                    "{\"seq\":2}", null);
            store.markFailed("F001", "reception", "event-2", Instant.parse("2026-03-25T11:03:00Z"),
                    "apply_failed", "broken payload", "recovery-3");

            List<OrcaPushEventInboxStore.EventInboxRow> stillApplied = store.findApplied("F001", "reception");
            assertThat(stillApplied).hasSize(1);
            assertThat(stillApplied.get(0).eventUuid()).isEqualTo("event-1");
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

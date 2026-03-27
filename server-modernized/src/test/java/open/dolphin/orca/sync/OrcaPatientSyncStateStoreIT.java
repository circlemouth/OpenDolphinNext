package open.dolphin.orca.sync;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.ResultSet;
import java.time.LocalDate;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class OrcaPatientSyncStateStoreIT {

    @Test
    void storeWorksOnlyAfterFlywayCreatesSchema() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            OrcaPatientSyncStateStore store = new OrcaPatientSyncStateStore();
            setField(store, "dataSource", dataSource);

            store.markSuccess("F001", LocalDate.of(2026, 3, 21), "RUN-BEFORE");
            assertThat(store.loadFacilityState("F001")).isNull();
            try (Connection connection = dataSource.getConnection()) {
                assertThat(tableExists(connection, "opendolphin", "d_orca_patient_sync_state")).isFalse();
            }

            Flyway.configure()
                    .dataSource(dataSource)
                    .defaultSchema("opendolphin")
                    .schemas("opendolphin")
                    .locations("classpath:db/migration")
                    .load()
                    .migrate();

            store.markSuccess("F001", LocalDate.of(2026, 3, 21), "RUN-AFTER");
            OrcaPatientSyncStateStore.FacilityState state = store.loadFacilityState("F001");

            assertThat(state).isNotNull();
            assertThat(state.lastSyncDate()).isEqualTo("2026-03-21");
            assertThat(state.lastRunId()).isEqualTo("RUN-AFTER");
            assertThat(state.lastError()).isNull();

            store.markFailure("F001", "sync failed", "RUN-FAIL");
            OrcaPatientSyncStateStore.FacilityState failed = store.loadFacilityState("F001");
            assertThat(failed).isNotNull();
            assertThat(failed.lastRunId()).isEqualTo("RUN-FAIL");
            assertThat(failed.lastError()).isEqualTo("sync failed");
        }
    }

    private static boolean tableExists(Connection connection, String schema, String table) throws Exception {
        try (ResultSet resultSet = connection.getMetaData().getTables(null, schema, table, null)) {
            return resultSet.next();
        }
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}

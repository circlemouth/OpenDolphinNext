package open.dolphin.orca.sync;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.time.Instant;
import java.time.LocalDate;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class OrcaPatientSyncPlannerTest {

    @Test
    void plansOnlyDueEnabledFacilitySchedulesAndUsesCursorOrLookback() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaSyncCursorStore cursorStore = new OrcaSyncCursorStore();
            OrcaSyncRunStore runStore = new OrcaSyncRunStore();
            setField(cursorStore, "dataSource", dataSource);
            setField(runStore, "dataSource", dataSource);

            insertSchedule(dataSource, "F001", true, 15, 3);
            insertSchedule(dataSource, "F002", true, 15, 5);
            insertSchedule(dataSource, "F003", false, 15, 7);
            cursorStore.save("F001", OrcaPatientSyncPlanner.STREAM_KIND, "date", "2026-03-20", "RUN-OLD");
            runStore.createRequested("run-latest", "F002", OrcaPatientSyncPlanner.STREAM_KIND, "scheduler",
                    Instant.parse("2026-03-25T09:55:00Z"), 0);

            OrcaPatientSyncPlanner planner = new OrcaPatientSyncPlanner();
            setField(planner, "dataSource", dataSource);
            setField(planner, "cursorStore", cursorStore);
            setField(planner, "runStore", runStore);

            var plans = planner.planDueRuns(LocalDate.of(2026, 3, 25), Instant.parse("2026-03-25T10:00:00Z"));

            assertThat(plans).hasSize(1);
            OrcaPatientSyncPlanner.PlannedSync planned = plans.get(0);
            assertThat(planned.facilityId()).isEqualTo("F001");
            assertThat(planned.request().getStartDate()).isEqualTo(LocalDate.of(2026, 3, 20));
            assertThat(planned.request().getEndDate()).isEqualTo(LocalDate.of(2026, 3, 25));
            assertThat(planned.runId()).matches("SYNC-F001-20260325100000-[0-9a-f]{8}");
        }
    }

    private static void insertSchedule(DataSource dataSource, String facilityId, boolean enabled, int intervalMinutes, int lookbackDays)
            throws Exception {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     INSERT INTO opendolphin.orca_job_schedule
                         (facility_id, job_kind, enabled, interval_minutes, initial_lookback_days, updated_by)
                     VALUES (?, ?, ?, ?, ?, ?)
                     """)) {
            statement.setString(1, facilityId);
            statement.setString(2, OrcaPatientSyncPlanner.JOB_KIND);
            statement.setBoolean(3, enabled);
            statement.setInt(4, intervalMinutes);
            statement.setInt(5, lookbackDays);
            statement.setString(6, "test");
            statement.executeUpdate();
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

package open.dolphin.encounter;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import javax.sql.DataSource;
import open.dolphin.reconciliation.ReconciliationTaskRepository;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class EncounterProjectionRepositoryTest {

    @Test
    void scheduleEncounterTransitionAndReconciliationRepositoriesPersistCanonicalKeys() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            ScheduleProjectionRepository scheduleRepository = new ScheduleProjectionRepository();
            EncounterProjectionRepository encounterRepository = new EncounterProjectionRepository();
            EncounterTransitionLogRepository transitionLogRepository = new EncounterTransitionLogRepository();
            ReconciliationTaskRepository reconciliationTaskRepository = new ReconciliationTaskRepository();
            setField(scheduleRepository, "dataSource", dataSource);
            setField(encounterRepository, "dataSource", dataSource);
            setField(transitionLogRepository, "dataSource", dataSource);
            setField(reconciliationTaskRepository, "dataSource", dataSource);

            scheduleRepository.upsertFromOrca(new ScheduleProjectionRepository.ScheduleUpsertCommand(
                    "schedule:F001:A100",
                    "F001",
                    "P001",
                    10L,
                    "A100",
                    Instant.parse("2026-03-25T09:00:00Z"),
                    "01",
                    "DR01",
                    "scheduled",
                    null,
                    Instant.parse("2026-03-25T08:59:00Z"),
                    Instant.parse("2026-03-25T09:01:00Z")));

            encounterRepository.upsertCheckedIn(new EncounterProjectionRepository.EncounterUpsertCommand(
                    "encounter:F001:E100",
                    "F001",
                    "P001",
                    10L,
                    "schedule:F001:A100",
                    "E100",
                    Instant.parse("2026-03-25T09:05:00Z"),
                    "checked_in",
                    null,
                    null,
                    null,
                    "doctor-1",
                    "first visit",
                    "{\"waiting\":true}",
                    Instant.parse("2026-03-25T09:06:00Z"),
                    0L,
                    Instant.parse("2026-03-25T09:06:00Z")));

            scheduleRepository.linkEncounter(
                    "schedule:F001:A100",
                    "encounter:F001:E100",
                    Instant.parse("2026-03-25T09:07:00Z"));

            encounterRepository.transitionState(
                    "encounter:F001:E100",
                    "billed",
                    Instant.parse("2026-03-25T09:10:00Z"),
                    Instant.parse("2026-03-25T09:15:00Z"),
                    null,
                    "doctor-1",
                    "billed ok",
                    "{\"waiting\":false,\"billed\":true}",
                    Instant.parse("2026-03-25T09:15:00Z"),
                    Instant.parse("2026-03-25T09:15:01Z"));

            EncounterProjectionRepository.EncounterRow row =
                    encounterRepository.findByEncounterKey("encounter:F001:E100");
            assertThat(row).isNotNull();
            assertThat(row.encounterKey()).isEqualTo("encounter:F001:E100");
            assertThat(row.scheduleKey()).isEqualTo("schedule:F001:A100");
            assertThat(row.businessState()).isEqualTo("billed");
            assertThat(row.stateVersion()).isEqualTo(1L);
            assertThat(row.billedAt()).isEqualTo(Instant.parse("2026-03-25T09:15:00Z"));
            assertThat(row.worklistFlagsJson()).contains("\"billed\": true");

            transitionLogRepository.insertAttempt(
                    "F001",
                    "encounter:F001:E100",
                    "bill",
                    "checked_in",
                    "billed",
                    "req-100",
                    "trace-100",
                    "idem-100",
                    null,
                    false);
            transitionLogRepository.markReconciliationRequired(
                    "F001",
                    "encounter:F001:E100",
                    "idem-100",
                    "orca mismatch");

            reconciliationTaskRepository.openTask(
                    "F001",
                    "encounter",
                    "encounter:F001:E100",
                    "orca_mismatch",
                    "open",
                    "high",
                    "{\"encounterKey\":\"encounter:F001:E100\"}");

            try (Connection connection = dataSource.getConnection()) {
                assertThat(queryString(connection,
                        "select linked_encounter_key from opendolphin.schedule_projection where schedule_key = ?",
                        "schedule:F001:A100")).isEqualTo("encounter:F001:E100");
                assertThat(queryBoolean(connection,
                        "select reconciliation_required from opendolphin.encounter_transition_log where facility_id = ? and encounter_key = ? and idempotency_key = ?",
                        "F001", "encounter:F001:E100", "idem-100")).isTrue();
                assertThat(queryString(connection,
                        "select subject_key from opendolphin.reconciliation_task where facility_id = ? and subject_type = ?",
                        "F001", "encounter")).isEqualTo("encounter:F001:E100");
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

    private static String queryString(Connection connection, String sql, Object... params) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                statement.setObject(i + 1, params[i]);
            }
            try (ResultSet resultSet = statement.executeQuery()) {
                assertThat(resultSet.next()).isTrue();
                return resultSet.getString(1);
            }
        }
    }

    private static boolean queryBoolean(Connection connection, String sql, Object... params) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                statement.setObject(i + 1, params[i]);
            }
            try (ResultSet resultSet = statement.executeQuery()) {
                assertThat(resultSet.next()).isTrue();
                return resultSet.getBoolean(1);
            }
        }
    }
}

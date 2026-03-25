package open.dolphin.orca.sync;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.lang.reflect.Field;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import javax.sql.DataSource;
import open.dolphin.orca.service.DefaultOrcaLiveGateway;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientIdListRequest;
import open.dolphin.rest.dto.orca.PatientIdListResponse;
import open.dolphin.rest.dto.orca.PatientIdListResponse.PatientSyncEntry;
import open.dolphin.rest.dto.orca.PatientImportRequest;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.rest.dto.orca.PatientSummary;
import open.dolphin.rest.dto.orca.PatientSyncRequest;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class OrcaPatientSyncRunnerTest {

    @Test
    void completedRunPersistsRunStateAndAdvancesCursor() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaSyncCursorStore cursorStore = new OrcaSyncCursorStore();
            OrcaSyncRunStore runStore = new OrcaSyncRunStore();
            setField(cursorStore, "dataSource", dataSource);
            setField(runStore, "dataSource", dataSource);

            FakeImportService importService = new FakeImportService(false);
            OrcaPatientSyncRunner runner = new OrcaPatientSyncRunner(new FakeLiveGateway(), importService, cursorStore, runStore);

            PatientSyncRequest request = new PatientSyncRequest();
            request.setStartDate(LocalDate.of(2026, 3, 20));
            request.setEndDate(LocalDate.of(2026, 3, 21));

            PatientImportResponse response = runner.run("F001", request, "api", "RUN-OK");

            assertThat(response.getRequestedCount()).isEqualTo(2);
            assertThat(runStore.load("RUN-OK").status()).isEqualTo("completed");
            assertThat(runStore.load("RUN-OK").trigger()).isEqualTo("api");
            assertThat(cursorStore.load("F001", OrcaPatientSyncPlanner.STREAM_KIND).cursorValue()).isEqualTo("2026-03-21");
            assertThat(cursorStore.load("F001", OrcaPatientSyncPlanner.STREAM_KIND).lastAppliedRunId()).isEqualTo("RUN-OK");
            assertThat(importService.importedPatientIds).containsExactly("000001", "000002");
        }
    }

    @Test
    void partialRunDoesNotAdvanceCursor() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            OrcaSyncCursorStore cursorStore = new OrcaSyncCursorStore();
            OrcaSyncRunStore runStore = new OrcaSyncRunStore();
            setField(cursorStore, "dataSource", dataSource);
            setField(runStore, "dataSource", dataSource);
            cursorStore.save("F001", OrcaPatientSyncPlanner.STREAM_KIND, "date", "2026-03-19", "RUN-BEFORE");

            OrcaPatientSyncRunner runner = new OrcaPatientSyncRunner(
                    new FakeLiveGateway(),
                    new FakeImportService(true),
                    cursorStore,
                    runStore);

            PatientSyncRequest request = new PatientSyncRequest();
            request.setStartDate(LocalDate.of(2026, 3, 20));
            request.setEndDate(LocalDate.of(2026, 3, 21));

            PatientImportResponse response = runner.run("F001", request, "scheduler", "SYNC-F001-20260325100000-abcdef12");

            OrcaSyncRunStore.RunRow run = runStore.load("SYNC-F001-20260325100000-abcdef12");
            assertThat(response.getApiResult()).isEqualTo("10");
            assertThat(run.status()).isEqualTo("partial");
            assertThat(run.trigger()).isEqualTo("scheduler");
            assertThat(run.failedCount()).isEqualTo(1);
            assertThat(cursorStore.load("F001", OrcaPatientSyncPlanner.STREAM_KIND).cursorValue()).isEqualTo("2026-03-19");
            assertThat(cursorStore.load("F001", OrcaPatientSyncPlanner.STREAM_KIND).lastAppliedRunId()).isEqualTo("RUN-BEFORE");
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

    private static final class FakeLiveGateway extends DefaultOrcaLiveGateway {
        @Override
        public PatientIdListResponse getPatientIdList(String facilityId, PatientIdListRequest request) {
            PatientIdListResponse response = new PatientIdListResponse();
            response.setApiResult("0000");
            response.setApiResultMessage("OK");
            response.setTargetPatientCount(2);
            response.getPatients().add(entry("000001"));
            response.getPatients().add(entry("000002"));
            return response;
        }

        private PatientSyncEntry entry(String patientId) {
            PatientSyncEntry entry = new PatientSyncEntry();
            PatientSummary summary = new PatientSummary();
            summary.setPatientId(patientId);
            entry.setSummary(summary);
            return entry;
        }
    }

    private static final class FakeImportService extends OrcaPatientImportService {
        private final boolean partial;
        private List<String> importedPatientIds = List.of();

        private FakeImportService(boolean partial) {
            this.partial = partial;
        }

        @Override
        public PatientImportResponse importPatients(String facilityId, PatientImportRequest request, String runId) {
            importedPatientIds = List.copyOf(request.getPatientIds());
            PatientImportResponse response = new PatientImportResponse();
            response.setFacilityId(facilityId);
            response.setRunId(runId);
            response.setRequestedCount(request.getPatientIds().size());
            response.setFetchedCount(request.getPatientIds().size());
            response.setCreatedCount(partial ? 1 : request.getPatientIds().size());
            response.setUpdatedCount(0);
            response.setSkippedCount(0);
            response.setRecordsReturned(request.getPatientIds().size());
            if (partial) {
                PatientImportResponse.ImportError error = new PatientImportResponse.ImportError();
                error.setPatientId("000002");
                error.setMessage("invalid payload");
                response.getErrors().add(error);
                response.setApiResult("10");
                response.setApiResultMessage("PARTIAL");
            } else {
                response.setApiResult("00");
                response.setApiResultMessage("OK");
            }
            return response;
        }
    }
}

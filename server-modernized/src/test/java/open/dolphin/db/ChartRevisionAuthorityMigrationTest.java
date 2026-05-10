package open.dolphin.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import open.dolphin.infomodel.ChartRevisionStatus;
import org.junit.jupiter.api.Test;

class ChartRevisionAuthorityMigrationTest {

    private static final Path MIGRATION = Path.of(
            "tools",
            "flyway",
            "sql",
            "V0316__chart_revision_authority_tables.sql");

    @Test
    void migrationCreatesMinimumChartRevisionAuthorityTables() throws Exception {
        String sql = Files.readString(MIGRATION);

        assertThat(sql).contains("CREATE TABLE IF NOT EXISTS opendolphin.chart_document");
        assertThat(sql).contains("CREATE TABLE IF NOT EXISTS opendolphin.chart_revision");
        assertThat(sql).contains("CREATE TABLE IF NOT EXISTS opendolphin.chart_revision_event");
        assertThat(sql).contains("REFERENCES opendolphin.d_karte(id) ON DELETE RESTRICT");
        assertThat(sql).contains("REFERENCES opendolphin.d_patient(id) ON DELETE RESTRICT");
        assertThat(sql).contains("REFERENCES opendolphin.d_document(id) ON DELETE SET NULL");
        assertThat(sql).contains("CONSTRAINT uk_chart_revision_number UNIQUE (chart_document_id, revision_number)");
        assertThat(sql).contains("before_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb");
        assertThat(sql).contains("after_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb");
    }

    @Test
    void migrationStatusConstraintMatchesJavaEnum() throws Exception {
        String sql = Files.readString(MIGRATION);
        Set<String> enumNames = Arrays.stream(ChartRevisionStatus.values())
                .map(Enum::name)
                .collect(Collectors.toUnmodifiableSet());

        for (String status : enumNames) {
            assertThat(sql).contains("'" + status + "'");
        }
        assertThat(enumNames).containsExactlyInAnyOrder(
                "DRAFT",
                "FINAL",
                "AMENDED",
                "ADDENDUM",
                "CANCELLED",
                "VOIDED");
        assertFalse(sql.contains("'SIGNED'"));
        assertFalse(sql.contains("'MODIFIED'"));
    }

    @Test
    void nonDraftRevisionsRequireFinalizationMetadata() throws Exception {
        String sql = Files.readString(MIGRATION);

        assertTrue(sql.contains("ck_chart_revision_finalized_metadata"));
        assertTrue(sql.contains("status <> 'DRAFT' AND finalized_at IS NOT NULL AND finalized_by_user_id IS NOT NULL"));
        assertTrue(sql.contains("status = 'DRAFT' AND finalized_at IS NULL AND finalized_by_user_id IS NULL"));
    }
}

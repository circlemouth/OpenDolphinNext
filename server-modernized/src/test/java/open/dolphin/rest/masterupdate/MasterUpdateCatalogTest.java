package open.dolphin.rest.masterupdate;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MasterUpdateCatalogTest {

    @Test
    void defaultCatalogIncludesLocalMasterCacheImportDataset() {
        MasterUpdateCatalog.DatasetDefinition definition = MasterUpdateCatalog.defaultDefinitions().stream()
                .filter(candidate -> "local_orca_master_cache".equals(candidate.getCode()))
                .findFirst()
                .orElseThrow();

        assertThat(definition.getSourceUrl())
                .isEqualTo("classpath:open/orca/master/local-orca-master-cache-fixture.csv");
        assertThat(definition.getFormat()).isEqualTo("CSV");
        assertThat(definition.isAutoEnabled()).isTrue();
        assertThat(definition.isManualUploadAllowed()).isTrue();
        assertThat(definition.getDefaultIntervalMinutes()).isEqualTo(24 * 60);
        assertThat(definition.getUsageNotes()).contains("ORCA 正本ではない");
    }
}

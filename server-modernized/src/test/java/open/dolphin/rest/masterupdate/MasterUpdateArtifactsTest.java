package open.dolphin.rest.masterupdate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class MasterUpdateArtifactsTest {

    @Test
    void fetchDatasetArtifactLoadsClasspathFixtureWithoutOrcaDb() {
        MasterUpdateStore.DatasetState dataset = new MasterUpdateStore.DatasetState();
        dataset.code = "local_orca_master_cache";
        dataset.sourceUrl = "classpath:open/orca/master/local-orca-master-cache-fixture.csv";

        MasterUpdateStore.Snapshot snapshot = new MasterUpdateStore.Snapshot();
        snapshot.datasets.put(dataset.code, dataset);

        MasterUpdateStore store = mock(MasterUpdateStore.class);
        when(store.getSnapshot()).thenReturn(snapshot);

        MasterUpdateArtifacts artifacts = new MasterUpdateArtifacts(null, null, null);

        MasterUpdateArtifacts.UpdateArtifact artifact =
                artifacts.fetchDatasetArtifact(store, "local_orca_master_cache");

        assertThat(artifact.payload).isNotEmpty();
        assertThat(new String(artifact.payload, StandardCharsets.UTF_8)).contains("ゲンタシン軟膏");
        assertThat(artifact.hash).hasSize(64);
        assertThat(artifact.recordCount).isGreaterThan(0L);
        assertThat(artifact.suggestedExtension).isEqualTo("csv");
        assertThat(artifact.sourceUrl)
                .isEqualTo("classpath:open/orca/master/local-orca-master-cache-fixture.csv");
    }
}

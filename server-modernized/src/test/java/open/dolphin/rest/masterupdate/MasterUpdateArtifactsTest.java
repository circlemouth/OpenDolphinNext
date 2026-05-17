package open.dolphin.rest.masterupdate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
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

    @Test
    void rejectsExternalSourceUrlWithCredentialsOrQueryBeforeFetch() {
        MasterUpdateStore.DatasetState dataset = new MasterUpdateStore.DatasetState();
        dataset.code = "local_orca_master_cache";
        dataset.sourceUrl = "https://user:pass@masters.example.test/private/master.csv?token=secret";

        MasterUpdateStore.Snapshot snapshot = new MasterUpdateStore.Snapshot();
        snapshot.datasets.put(dataset.code, dataset);

        MasterUpdateStore store = mock(MasterUpdateStore.class);
        when(store.getSnapshot()).thenReturn(snapshot);

        ServerConfigurationResolver resolver = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_MASTER_UPDATE_SOURCE_ALLOWED_HOSTS, "masters.example.test");
        MasterUpdateArtifacts artifacts = new MasterUpdateArtifacts(null, resolver, null);

        assertThatThrownBy(() -> artifacts.fetchDatasetArtifact(store, "local_orca_master_cache"))
                .isInstanceOf(MasterUpdateService.MasterUpdateException.class)
                .satisfies(ex -> {
                    MasterUpdateService.MasterUpdateException updateEx =
                            (MasterUpdateService.MasterUpdateException) ex;
                    assertThat(updateEx.getCode()).isEqualTo("source_url_credentials_forbidden");
                    assertThat(updateEx.getMessage()).doesNotContain("user:pass");
                    assertThat(updateEx.getMessage()).doesNotContain("token=secret");
                });
    }

    @Test
    void rejectsExternalSourceHostOutsideAllowlist() {
        MasterUpdateStore.DatasetState dataset = new MasterUpdateStore.DatasetState();
        dataset.code = "local_orca_master_cache";
        dataset.sourceUrl = "https://untrusted.example.test/master.csv";

        MasterUpdateStore.Snapshot snapshot = new MasterUpdateStore.Snapshot();
        snapshot.datasets.put(dataset.code, dataset);

        MasterUpdateStore store = mock(MasterUpdateStore.class);
        when(store.getSnapshot()).thenReturn(snapshot);

        ServerConfigurationResolver resolver = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_MASTER_UPDATE_SOURCE_ALLOWED_HOSTS, "masters.example.test");
        MasterUpdateArtifacts artifacts = new MasterUpdateArtifacts(null, resolver, null);

        assertThatThrownBy(() -> artifacts.fetchDatasetArtifact(store, "local_orca_master_cache"))
                .isInstanceOf(MasterUpdateService.MasterUpdateException.class)
                .satisfies(ex -> {
                    MasterUpdateService.MasterUpdateException updateEx =
                            (MasterUpdateService.MasterUpdateException) ex;
                    assertThat(updateEx.getCode()).isEqualTo("source_host_not_allowed");
                    assertThat(updateEx.getMessage()).doesNotContain("untrusted.example.test");
                });
    }
}

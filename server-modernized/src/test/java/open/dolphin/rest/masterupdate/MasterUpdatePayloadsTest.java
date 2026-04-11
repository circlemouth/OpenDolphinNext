package open.dolphin.rest.masterupdate;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MasterUpdatePayloadsTest {

    @Test
    void toDetailSeparatesOfficialSourceAndLocalArtifacts() {
        MasterUpdateStore.DatasetState state = new MasterUpdateStore.DatasetState();
        state.code = "orca_master_core";
        state.name = "ORCA core master";
        state.sourceUrl = "https://example.invalid/master";
        state.updateFrequency = "15分";
        state.format = "XML";
        state.usageNotes = "read-only";
        state.manualUploadAllowed = false;
        state.currentVersionId = "20260411-aaaa1111";
        state.currentRecordCount = 5L;
        state.lastCheckedAt = "2026-04-11T00:00:00Z";
        state.lastPolledAt = "2026-04-11T00:05:00Z";
        state.updateDetected = true;
        state.latestRunId = "RUN-MASTER";
        state.latestJobMessage = "update available";

        MasterUpdateStore.DatasetVersion version = new MasterUpdateStore.DatasetVersion();
        version.versionId = "20260411-aaaa1111";
        version.capturedAt = "2026-04-11T00:10:00Z";
        version.artifactPath = "/tmp/master.xml";
        version.sourceUrl = "orca:masterlastupdatev3";
        version.summary = "summary";
        version.triggerType = "MANUAL";
        version.current = true;
        state.versions = List.of(version);

        Map<String, Object> detail = MasterUpdatePayloads.toDetail(state);

        assertThat(detail).containsKeys("officialSource", "localArtifacts");
        @SuppressWarnings("unchecked")
        Map<String, Object> officialSource = (Map<String, Object>) detail.get("officialSource");
        @SuppressWarnings("unchecked")
        Map<String, Object> localArtifacts = (Map<String, Object>) detail.get("localArtifacts");
        assertThat(officialSource.get("kind")).isEqualTo("masterlastupdatev3");
        assertThat(officialSource.get("updateDetected")).isEqualTo(true);
        assertThat(localArtifacts.get("currentArtifactPath")).isEqualTo("/tmp/master.xml");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> versions = (List<Map<String, Object>>) localArtifacts.get("versions");
        assertThat(versions).hasSize(1);
        assertThat(versions.get(0).get("sourceKind")).isEqualTo("official_fetch");
    }
}

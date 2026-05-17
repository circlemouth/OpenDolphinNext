package open.orca.master;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalOrcaMasterCacheParityVerifierTest {

    private static final String RESOURCE = "open/orca/master/local-orca-master-cache-fixture.csv";

    @TempDir
    Path tempDir;

    @Test
    void verifiesSanitizedDbContainerParitySnapshot() throws Exception {
        Path artifact = buildArtifact();
        Path snapshot = tempDir.resolve("parity-snapshot.csv");
        Files.writeString(snapshot, String.join("\n",
                "masterType,rowCount,sampleCode,sampleName,sampleValidFrom,sampleValidTo",
                "drug,1,620006949,ゲンタシン軟膏０．１％,20240401,99991231",
                "generic-price,1,620006949,ゲンタシン軟膏０．１％,20240401,99991231",
                "generic-class,1,264,鎮痛・鎮痒・収斂・消炎剤,20240401,99991231",
                "hokenja,1,01130012,全国健康保険協会 東京支部,20240401,99991231",
                "address,1,1000001,東京都千代田区千代田,20240401,99991231",
                "etensu,1,160000010,血液採取,20240401,99991231",
                "comment,1,008500001,別途コメント,20240401,99991231",
                "bodypart,1,002000001,胸部,20240401,99991231",
                "youhou,1,001000001,１日１回朝食後,20240401,99991231",
                "material,1,700000031,カテーテル材料,20240401,99991231",
                "kensa-sort,1,160000010,血液検査,20240401,99991231",
                "disease-candidate,1,8839001,高血圧症,20240401,99991231",
                "order-inputsets,4,S60001,細菌検査セット,20240401,99991231",
                "order-interactions,1,620006949,,20240401,99991231",
                ""),
                StandardCharsets.UTF_8);

        LocalOrcaMasterCacheParityVerifier.ParityResult result =
                new LocalOrcaMasterCacheParityVerifier().verify(artifact, snapshot);

        assertThat(result.expectationCount()).isEqualTo(14);
        assertThat(result.artifactRowCount()).isEqualTo(17L);
    }

    @Test
    void failsWhenDbContainerParitySnapshotDiffers() throws Exception {
        Path artifact = buildArtifact();
        Path snapshot = tempDir.resolve("parity-snapshot-mismatch.csv");
        Files.writeString(snapshot, String.join("\n",
                "masterType,rowCount,sampleCode,sampleName,sampleValidFrom,sampleValidTo",
                "drug,2,620006949,ゲンタシン軟膏０．１％,20240401,99991231",
                ""),
                StandardCharsets.UTF_8);

        assertThatThrownBy(() -> new LocalOrcaMasterCacheParityVerifier().verify(artifact, snapshot))
                .isInstanceOf(LocalOrcaMasterCacheParityVerifier.ParityVerificationException.class)
                .hasMessageContaining("count mismatch: drug")
                .hasMessageNotContaining("password")
                .hasMessageNotContaining("token=");
    }

    private Path buildArtifact() throws Exception {
        Path sourceDirectory = tempDir.resolve("source");
        Files.createDirectories(sourceDirectory);
        Files.copy(copyFixture(), sourceDirectory.resolve(LocalOrcaMasterCacheArtifactSpec.CANONICAL_CSV_PATH));
        Path artifact = tempDir.resolve("opendolphin-local-orca-master-cache.zip");
        new LocalOrcaMasterCacheArtifactBuilder().build(new LocalOrcaMasterCacheArtifactBuilder.BuildRequest(
                sourceDirectory,
                artifact,
                "official-file",
                "https://masters.example.test/orca-master-source",
                "fixture-import-20260517",
                "2026-05-17T10:03:13Z"));
        return artifact;
    }

    private Path copyFixture() throws Exception {
        Path target = tempDir.resolve("fixture.csv");
        try (InputStream input = Thread.currentThread().getContextClassLoader().getResourceAsStream(RESOURCE)) {
            assertThat(input).isNotNull();
            Files.copy(input, target);
        }
        return target;
    }
}

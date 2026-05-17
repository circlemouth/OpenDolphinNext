package open.orca.master;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalOrcaMasterCacheArtifactBuilderTest {

    private static final String RESOURCE = "open/orca/master/local-orca-master-cache-fixture.csv";
    private static final ObjectMapper JSON = new ObjectMapper();

    @TempDir
    Path tempDir;

    @Test
    void buildsVersionedZipWithManifestAndCanonicalCsv() throws Exception {
        Path sourceDirectory = sourceDirectoryWithFixture();
        Path output = tempDir.resolve("opendolphin-local-orca-master-cache.zip");

        LocalOrcaMasterCacheArtifactBuilder.BuildResult result =
                new LocalOrcaMasterCacheArtifactBuilder().build(new LocalOrcaMasterCacheArtifactBuilder.BuildRequest(
                        sourceDirectory,
                        output,
                        "official-file",
                        "https://masters.example.test/orca-master-source",
                        "orca-master-20260517",
                        "2026-05-17T10:03:13Z"));

        assertThat(result.outputPath()).exists();
        assertThat(result.rowCount()).isEqualTo(17L);
        assertThat(result.masterTypeCounts()).containsKeys(
                "drug",
                "order-inputsets",
                "order-interactions",
                "disease-candidate");

        JsonNode manifest = readManifest(output);
        assertThat(manifest.get("schemaVersion").asText())
                .isEqualTo(LocalOrcaMasterCacheArtifactSpec.SCHEMA_VERSION);
        assertThat(manifest.get("sourceId").asText())
                .isEqualTo("https://masters.example.test/orca-master-source");
        assertThat(manifest.get("artifactSha256").asText()).isEqualTo(result.artifactSha256());
        assertThat(manifest.get("masterTypeCounts").get("order-inputsets").asLong()).isEqualTo(4L);
    }

    @Test
    void rejectsPartialSourceMissingRequiredMasterType() throws Exception {
        Path sourceDirectory = tempDir.resolve("partial-source");
        Files.createDirectories(sourceDirectory);
        String fixture = Files.readString(copyFixture(), StandardCharsets.UTF_8);
        Files.writeString(
                sourceDirectory.resolve(LocalOrcaMasterCacheArtifactSpec.CANONICAL_CSV_PATH),
                fixture.lines()
                        .filter(line -> !line.startsWith("entry,disease-candidate,"))
                        .reduce((left, right) -> left + "\n" + right)
                        .orElseThrow() + "\n",
                StandardCharsets.UTF_8);

        assertThatThrownBy(() -> new LocalOrcaMasterCacheArtifactBuilder().build(
                new LocalOrcaMasterCacheArtifactBuilder.BuildRequest(
                        sourceDirectory,
                        tempDir.resolve("partial.zip"),
                        "official-file",
                        "https://masters.example.test/orca-master-source",
                        "orca-master-20260517",
                        "2026-05-17T10:03:13Z")))
                .isInstanceOf(LocalOrcaMasterCacheArtifactBuilder.ArtifactBuildException.class)
                .hasMessage("canonical artifact の必須 master type が不足しています。");
    }

    @Test
    void rejectsCredentialBearingSourceId() throws Exception {
        Path sourceDirectory = sourceDirectoryWithFixture();

        assertThatThrownBy(() -> new LocalOrcaMasterCacheArtifactBuilder().build(
                new LocalOrcaMasterCacheArtifactBuilder.BuildRequest(
                        sourceDirectory,
                        tempDir.resolve("secret.zip"),
                        "official-file",
                "https://user:password@masters.example.test/master.zip?token=secret",
                        "orca-master-20260517",
                        "2026-05-17T10:03:13Z")))
                .isInstanceOf(LocalOrcaMasterCacheArtifactBuilder.ArtifactBuildException.class)
                .hasMessageContaining("sourceId に認証情報")
                .hasMessageNotContaining("user:password")
                .hasMessageNotContaining("token=secret");
    }

    private JsonNode readManifest(Path artifact) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(artifact), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (LocalOrcaMasterCacheArtifactSpec.MANIFEST_PATH.equals(entry.getName())) {
                    return JSON.readTree(zip.readAllBytes());
                }
            }
        }
        throw new AssertionError("manifest not found");
    }

    private Path sourceDirectoryWithFixture() throws Exception {
        Path sourceDirectory = tempDir.resolve("source");
        Files.createDirectories(sourceDirectory);
        Files.copy(copyFixture(), sourceDirectory.resolve(LocalOrcaMasterCacheArtifactSpec.CANONICAL_CSV_PATH));
        return sourceDirectory;
    }

    private Path copyFixture() throws Exception {
        Path target = tempDir.resolve("fixture-" + System.nanoTime() + ".csv");
        try (InputStream input = Thread.currentThread().getContextClassLoader().getResourceAsStream(RESOURCE)) {
            assertThat(input).isNotNull();
            Files.copy(input, target);
        }
        return target;
    }
}

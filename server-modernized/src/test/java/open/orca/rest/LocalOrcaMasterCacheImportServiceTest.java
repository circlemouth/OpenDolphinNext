package open.orca.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import open.dolphin.rest.masterupdate.MasterUpdateService;
import open.orca.master.LocalOrcaMasterCacheArtifactBuilder;
import open.orca.master.LocalOrcaMasterCacheArtifactSpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LocalOrcaMasterCacheImportServiceTest {

    private static final String RESOURCE = "open/orca/master/local-orca-master-cache-fixture.csv";

    @TempDir
    Path tempDir;

    @Mock
    EntityManager entityManager;

    @Mock
    Query query;

    private final List<String> sqlStatements = new ArrayList<>();

    private LocalOrcaMasterCacheImportService service;

    @BeforeEach
    void setUp() {
        service = new LocalOrcaMasterCacheImportService(entityManager);
        lenient().when(entityManager.createNativeQuery(anyString())).thenAnswer(invocation -> {
            sqlStatements.add(invocation.getArgument(0, String.class));
            return query;
        });
        lenient().when(query.setParameter(anyString(), any())).thenReturn(query);
        lenient().when(query.executeUpdate()).thenReturn(1);
    }

    @Test
    void importsClasspathFixtureIntoLocalCacheProjection() throws Exception {
        Path fixture = copyFixture();

        LocalOrcaMasterCacheImportService.ImportResult result = service.importArtifact(
                LocalOrcaMasterCacheImportService.DATASET_CODE,
                fixture,
                "classpath:" + RESOURCE,
                "MANUAL",
                "RUN-IMPORT-TEST");

        assertThat(result.importedRows()).isGreaterThan(0);
        assertThat(result.affectedMasterTypes()).contains(
                "drug",
                "etensu",
                "generic-price",
                "order-inputsets",
                "order-interactions",
                "disease-candidate");
        assertThat(result.masterTypeCounts())
                .containsEntry("drug", 1L)
                .containsEntry("order-inputsets", 4L)
                .containsEntry("order-interactions", 1L);
        verify(entityManager, atLeastOnce()).createNativeQuery(anyString());
        assertThat(sqlStatements)
                .noneMatch(sql -> sql.contains("ORCADS"))
                .noneMatch(sql -> sql.contains("ORCA_DB_"))
                .noneMatch(sql -> sql.contains("jma-receipt-docker-db-1"))
                .noneMatch(sql -> sql.contains("TBL_"))
                .noneMatch(sql -> sql.contains("tbl_"));
    }

    @Test
    void rejectsInvalidCsvWithSanitizedMessage() throws Exception {
        Path invalid = tempDir.resolve("invalid.csv");
        Files.writeString(invalid, "recordType,masterType\nentry,drug\n", StandardCharsets.UTF_8);

        assertThatThrownBy(() -> service.importArtifact(
                LocalOrcaMasterCacheImportService.DATASET_CODE,
                invalid,
                "classpath:" + RESOURCE,
                "MANUAL",
                "RUN-INVALID"))
                .isInstanceOf(MasterUpdateService.MasterUpdateException.class)
                .hasMessage("local master cache import の CSV 形式が不正です。")
                .satisfies(ex -> {
                    assertThat(ex.getMessage()).doesNotContain("opendolphin.local_orca_master");
                    assertThat(ex.getMessage()).doesNotContain("ORCA_DB");
                    assertThat(ex.getMessage()).doesNotContain("jma-receipt");
                });
    }

    @Test
    void importsCanonicalZipBundleFromOfficialDerivedSource() throws Exception {
        Path fixture = copyFixture();
        Path bundle = buildArtifactFromFixture(fixture);

        LocalOrcaMasterCacheImportService.ImportResult result = service.importArtifact(
                LocalOrcaMasterCacheImportService.DATASET_CODE,
                bundle,
                "https://masters.example.test/opendolphin-local-orca-master-cache.zip",
                "MANUAL",
                "RUN-ZIP-IMPORT");

        assertThat(result.importedRows()).isEqualTo(17L);
        assertThat(result.affectedMasterTypes()).contains(
                "drug",
                "etensu",
                "generic-price",
                "generic-class",
                "comment",
                "bodypart",
                "youhou",
                "material",
                "kensa-sort",
                "hokenja",
                "address",
                "order-inputsets",
                "order-interactions",
                "disease-candidate");
    }

    @Test
    void rejectsCanonicalZipWhenManifestHashDoesNotMatchCsv() throws Exception {
        Path bundle = buildArtifactFromFixture(copyFixture());
        Path tampered = tempDir.resolve("tampered-local-orca-master-cache.zip");
        try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(bundle), StandardCharsets.UTF_8);
             ZipOutputStream output = new ZipOutputStream(Files.newOutputStream(tampered), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                output.putNextEntry(new ZipEntry(entry.getName()));
                byte[] payload = zip.readAllBytes();
                if (LocalOrcaMasterCacheArtifactSpec.CANONICAL_CSV_PATH.equals(entry.getName())) {
                    output.write(payload);
                    output.write("# tampered\n".getBytes(StandardCharsets.UTF_8));
                } else {
                    output.write(payload);
                }
                output.closeEntry();
            }
        }

        assertThatThrownBy(() -> service.importArtifact(
                LocalOrcaMasterCacheImportService.DATASET_CODE,
                tampered,
                "https://masters.example.test/opendolphin-local-orca-master-cache.zip",
                "MANUAL",
                "RUN-MANIFEST-MISMATCH"))
                .isInstanceOf(MasterUpdateService.MasterUpdateException.class)
                .satisfies(ex -> {
                    MasterUpdateService.MasterUpdateException updateEx =
                            (MasterUpdateService.MasterUpdateException) ex;
                    assertThat(updateEx.getCode()).isEqualTo("local_master_cache_manifest_invalid");
                    assertThat(updateEx.getMessage()).doesNotContain("tampered");
                });
    }

    @Test
    void rejectsCanonicalZipWithoutManifest() throws Exception {
        Path fixture = copyFixture();
        Path bundle = tempDir.resolve("manifest-missing.zip");
        try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(bundle), StandardCharsets.UTF_8)) {
            zip.putNextEntry(new ZipEntry(LocalOrcaMasterCacheArtifactSpec.CANONICAL_CSV_PATH));
            Files.copy(fixture, zip);
            zip.closeEntry();
        }

        assertThatThrownBy(() -> service.importArtifact(
                LocalOrcaMasterCacheImportService.DATASET_CODE,
                bundle,
                "https://masters.example.test/opendolphin-local-orca-master-cache.zip",
                "MANUAL",
                "RUN-MANIFEST-MISSING"))
                .isInstanceOf(MasterUpdateService.MasterUpdateException.class)
                .satisfies(ex -> {
                    MasterUpdateService.MasterUpdateException updateEx =
                            (MasterUpdateService.MasterUpdateException) ex;
                    assertThat(updateEx.getCode()).isEqualTo("local_master_cache_manifest_invalid");
                });
    }

    @Test
    void rejectsPartialBundleMissingRequiredMasterType() throws Exception {
        Path partial = tempDir.resolve("partial.csv");
        String fixture = Files.readString(copyFixture(), StandardCharsets.UTF_8);
        String withoutDiseaseCandidate = fixture.lines()
                .filter(line -> !line.startsWith("entry,disease-candidate,"))
                .reduce((left, right) -> left + "\n" + right)
                .orElseThrow();
        Files.writeString(partial, withoutDiseaseCandidate + "\n", StandardCharsets.UTF_8);

        assertThatThrownBy(() -> service.importArtifact(
                LocalOrcaMasterCacheImportService.DATASET_CODE,
                partial,
                "https://masters.example.test/opendolphin-local-orca-master-cache.csv",
                "MANUAL",
                "RUN-PARTIAL"))
                .isInstanceOf(MasterUpdateService.MasterUpdateException.class)
                .hasMessage("local master cache import の必須 master type が不足しています。")
                .satisfies(ex -> {
                    MasterUpdateService.MasterUpdateException updateEx =
                            (MasterUpdateService.MasterUpdateException) ex;
                    assertThat(updateEx.getCode()).isEqualTo("local_master_cache_incomplete");
                });
    }

    @Test
    void rejectsInvalidPayloadJsonWithSanitizedMessage() throws Exception {
        Path invalid = tempDir.resolve("invalid-json.csv");
        String fixture = Files.readString(copyFixture(), StandardCharsets.UTF_8)
                .replaceFirst(",\\{\\}", ",not-json");
        Files.writeString(invalid, fixture, StandardCharsets.UTF_8);

        assertThatThrownBy(() -> service.importArtifact(
                LocalOrcaMasterCacheImportService.DATASET_CODE,
                invalid,
                "https://masters.example.test/opendolphin-local-orca-master-cache.csv",
                "MANUAL",
                "RUN-INVALID-JSON"))
                .isInstanceOf(MasterUpdateService.MasterUpdateException.class)
                .hasMessage("local master cache import の CSV 形式が不正です。")
                .satisfies(ex -> {
                    assertThat(ex.getMessage()).doesNotContain("opendolphin.local_orca_master");
                    assertThat(ex.getMessage()).doesNotContain("not-json");
                });
    }

    @Test
    void sanitizesCredentialBearingSourceUrl() {
        String sanitized = LocalOrcaMasterCacheImportService.sanitizeUri(
                "https://user:password@example.test/private/master.csv?token=secret");

        assertThat(sanitized).isEqualTo("https://example.test/private/master.csv");
    }

    @Test
    void supportsOnlyLocalMasterCacheDataset() {
        assertThat(service.supportsDataset("local_orca_master_cache")).isTrue();
        assertThat(service.supportsDataset("orca_master_core")).isFalse();
    }

    private Path copyFixture() throws Exception {
        Path target = tempDir.resolve("local-orca-master-cache-fixture.csv");
        try (InputStream input = Thread.currentThread().getContextClassLoader().getResourceAsStream(RESOURCE)) {
            assertThat(input).isNotNull();
            Files.copy(input, target);
        }
        return target;
    }

    private Path buildArtifactFromFixture(Path fixture) throws Exception {
        Path sourceDirectory = tempDir.resolve("builder-source");
        Files.createDirectories(sourceDirectory);
        Files.copy(fixture, sourceDirectory.resolve(LocalOrcaMasterCacheArtifactSpec.CANONICAL_CSV_PATH));
        Path bundle = tempDir.resolve("opendolphin-local-orca-master-cache.zip");
        new LocalOrcaMasterCacheArtifactBuilder().build(new LocalOrcaMasterCacheArtifactBuilder.BuildRequest(
                sourceDirectory,
                bundle,
                "official-file",
                "https://masters.example.test/orca-master-source",
                "fixture-import-20260517",
                "2026-05-17T10:03:13Z"));
        return bundle;
    }
}

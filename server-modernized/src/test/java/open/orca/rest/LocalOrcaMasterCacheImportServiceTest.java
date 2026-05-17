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
import open.dolphin.rest.masterupdate.MasterUpdateService;
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
}

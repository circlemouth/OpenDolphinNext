package open.dolphin.rest.masterupdate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Field;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import open.orca.rest.LocalOrcaMasterCacheImportService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class MasterUpdateServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void streamToFile_writesPayloadAndCalculatesHash() throws Exception {
        byte[] payload = "alpha\nbeta\n".getBytes(StandardCharsets.UTF_8);
        Path target = tempDir.resolve("master.txt");

        MasterUpdateService.StreamedArtifactData result =
                MasterUpdateService.streamToFile(new ByteArrayInputStream(payload), target);

        assertThat(result).isNotNull();
        assertThat(readAllBytes(target)).containsExactly(payload);
        assertThat(result.size()).isEqualTo(payload.length);
        assertThat(result.hash()).isEqualTo(sha256Hex(payload));
    }

    @Test
    void estimateRecordCount_countsZipEntriesFromFileStream() throws Exception {
        Path target = tempDir.resolve("master.zip");
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream();
             ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry("first.csv"));
            zip.write("a,b\n1,2\n".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            zip.putNextEntry(new ZipEntry("second.csv"));
            zip.write("c,d\n3,4\n".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            zip.finish();
            Files.write(target, bytes.toByteArray());
        }

        long count = MasterUpdateService.estimateRecordCount(target, "zip", "application/zip");

        assertThat(count).isEqualTo(2L);
    }

    @Test
    void estimateRecordCount_returnsZeroForEmptyPayload() {
        long count = MasterUpdateService.estimateRecordCount(new byte[0], "csv", "text/csv");

        assertThat(count).isZero();
    }

    @Test
    void runDatasetImportsLocalMasterCacheFixtureAndRecordsVersion() throws Exception {
        EntityManager entityManager = mock(EntityManager.class);
        Query query = mock(Query.class);
        List<String> sqlStatements = new ArrayList<>();
        when(entityManager.createNativeQuery(anyString())).thenAnswer(invocation -> {
            sqlStatements.add(invocation.getArgument(0, String.class));
            return query;
        });
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.executeUpdate()).thenReturn(1);

        LocalOrcaMasterCacheImportService importService = new LocalOrcaMasterCacheImportService();
        setField(importService, "entityManager", entityManager);

        MasterUpdateStore store = new MasterUpdateStore();
        store.init();

        MasterUpdateService service = new MasterUpdateService();
        setField(service, "store", store);
        setField(service, "configurationResolver", TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_SERVER_DATA_DIR, tempDir.toString()));
        setField(service, "localMasterCacheImportService", importService);

        Map<String, Object> body = service.runDataset(
                "local_orca_master_cache",
                "MANUAL",
                "test",
                "RUN-LOCAL-CACHE",
                true);

        assertThat(body.get("ok")).isEqualTo(Boolean.TRUE);
        assertThat(body.get("localMasterCacheImport")).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> importBody = (Map<String, Object>) body.get("localMasterCacheImport");
        assertThat(importBody.get("importedRows")).isEqualTo(17L);
        @SuppressWarnings("unchecked")
        List<String> affectedMasterTypes = (List<String>) importBody.get("affectedMasterTypes");
        assertThat(affectedMasterTypes).contains("drug", "order-interactions");
        assertThat(Files.exists(Path.of((String) body.get("artifactPath")))).isTrue();
        assertThat(store.getSnapshot().datasets.get("local_orca_master_cache").currentRecordCount).isEqualTo(17L);
        assertThat(sqlStatements)
                .noneMatch(sql -> sql.contains("ORCADS"))
                .noneMatch(sql -> sql.contains("ORCA_DB_"))
                .noneMatch(sql -> sql.contains("jma-receipt-docker-db-1"))
                .noneMatch(sql -> sql.contains("TBL_"))
                .noneMatch(sql -> sql.contains("tbl_"));
        verify(entityManager, atLeastOnce()).createNativeQuery(
                org.mockito.ArgumentMatchers.contains("local_orca_master_dataset"));
    }

    private static byte[] readAllBytes(Path path) throws Exception {
        return Files.readAllBytes(path);
    }

    private static String sha256Hex(byte[] payload) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload));
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

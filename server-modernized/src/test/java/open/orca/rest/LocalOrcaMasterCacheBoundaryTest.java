package open.orca.rest;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class LocalOrcaMasterCacheBoundaryTest {

    @Test
    void masterSearchDaosDoNotDependOnOrcaConnection() throws IOException {
        assertNoOrcaConnection("src/main/java/open/orca/rest/OrcaMasterDao.java");
        assertNoOrcaConnection("src/main/java/open/orca/rest/EtensuDao.java");
        assertNoOrcaConnection("src/main/java/open/dolphin/rest/orca/OrcaOrderMasterResource.java");
        assertNoOrcaConnection("src/main/java/open/dolphin/orca/read/OrcaOrderInputSetReadService.java");
        assertNoOrcaConnection("src/main/java/open/dolphin/orca/read/OrcaOrderInteractionReadService.java");
        assertNoOrcaConnection("src/main/java/open/dolphin/orca/read/OrcaLiveDiseaseMasterReadService.java");
        assertNoOrcaConnection("src/main/java/open/dolphin/mbean/ServletStartup.java");
        assertNoOrcaConnection("src/main/java/open/orca/rest/LocalOrcaMasterCacheImportService.java");
        assertNoOrcaConnection("src/main/java/open/dolphin/rest/masterupdate/MasterUpdateArtifacts.java");
    }

    @Test
    void localCacheMigrationDeclaresNotImportedAndUnavailableStatuses() throws IOException {
        String sql = Files.readString(resolve("tools/flyway/sql/V0336__local_orca_master_cache.sql"));

        assertTrue(sql.contains("local_orca_master_dataset"));
        assertTrue(sql.contains("NOT_IMPORTED"));
        assertTrue(sql.contains("UNAVAILABLE"));
        assertTrue(sql.contains("ゲンタシン軟膏"));
        assertTrue(sql.contains("local_orca_master_interaction"));
    }

    private static void assertNoOrcaConnection(String path) throws IOException {
        String source = Files.readString(resolve(path));
        assertFalse(source.contains("ORCAConnection"), path + " must not use ORCA DB direct connection");
        assertFalse(source.contains("tbl_"), path + " must not query ORCA DB tables");
        assertFalse(source.contains("TBL_"), path + " must not query ORCA DB tables");
    }

    private static Path resolve(String path) {
        Path modulePath = Path.of(path);
        if (Files.exists(modulePath)) {
            return modulePath;
        }
        return Path.of("server-modernized", path);
    }
}

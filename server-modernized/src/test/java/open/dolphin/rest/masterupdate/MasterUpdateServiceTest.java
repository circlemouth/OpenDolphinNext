package open.dolphin.rest.masterupdate;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HexFormat;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
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

    private static byte[] readAllBytes(Path path) throws Exception {
        return Files.readAllBytes(path);
    }

    private static String sha256Hex(byte[] payload) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload));
    }
}

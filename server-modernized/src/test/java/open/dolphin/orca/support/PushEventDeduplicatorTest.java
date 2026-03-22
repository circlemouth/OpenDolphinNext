package open.dolphin.orca.support;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import open.dolphin.runtime.config.ServerConfigurationResolver;

class PushEventDeduplicatorTest {

    @Test
    void createDefaultUsesServerDataDirectoryWhenConfigured() throws Exception {
        Path dataDir = Files.createTempDirectory("push-event-cache");
        ServerConfigurationResolver resolver = new ServerConfigurationResolver(java.util.Map.of(
                ServerConfigurationResolver.KEY_SERVER_DATA_DIR, dataDir.toString()));

        PushEventDeduplicator deduplicator = PushEventDeduplicator.createDefault(resolver);
        deduplicator.filter("""
                {"Event_Information":[{"Event_Id":"E-001"}]}
                """);

        Path expected = dataDir.resolve("orca").resolve("pushevent-cache.json");
        assertTrue(Files.exists(expected), "cache should be persisted under jboss.server.data.dir");
    }

    @Test
    void createDefaultRejectsMissingCachePathAndServerDataDirectory() {
        ServerConfigurationResolver resolver = new ServerConfigurationResolver(java.util.Map.of());

        assertThrows(IllegalStateException.class, () -> PushEventDeduplicator.createDefault(resolver));
    }
}

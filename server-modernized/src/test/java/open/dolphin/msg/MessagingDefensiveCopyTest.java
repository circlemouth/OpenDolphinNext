package open.dolphin.msg;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.text.DateFormat;
import java.util.Date;
import java.util.List;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;
import open.dolphin.session.AccountSummary;
import open.stamp.seed.CopyStampTreeBuilder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class MessagingDefensiveCopyTest {

    @AfterEach
    void tearDown() {
        System.clearProperty(ServerConfigurationResolver.KEY_FACILITY_ID);
        System.clearProperty(ServerConfigurationResolver.KEY_CLOUD_ZERO);
        System.clearProperty(ServerConfigurationResolver.KEY_PVT_ENABLED);
        System.clearProperty(ServerConfigurationResolver.KEY_PVT_BIND_IP);
        System.clearProperty(ServerConfigurationResolver.KEY_PVT_PORT);
    }

    @Test
    void accountSummaryClonesDate() {
        AccountSummary summary = new AccountSummary();
        Date registered = new Date();
        summary.setRegisteredDate(registered);

        registered.setTime(0);

        Date snapshot = summary.getRegisteredDate();
        assertTrue(snapshot.getTime() != 0);
        snapshot.setTime(0);
        assertTrue(summary.getRegisteredDate().getTime() != 0);
        summary.setMemberType("type");
        assertEquals(DateFormat.getDateInstance().format(summary.getRegisteredDate()), summary.getRdDate());
    }

    @Test
    void resolverExposesTypedOrcaRuntimeSettings() throws IOException {
        System.setProperty(ServerConfigurationResolver.KEY_FACILITY_ID, "facility01");
        System.setProperty(ServerConfigurationResolver.KEY_CLOUD_ZERO, "true");
        System.setProperty(ServerConfigurationResolver.KEY_PVT_ENABLED, "true");
        System.setProperty(ServerConfigurationResolver.KEY_PVT_BIND_IP, "127.0.0.1");
        System.setProperty(ServerConfigurationResolver.KEY_PVT_PORT, "5001");

        ServerRuntimeConfiguration.OrcaRuntimeSettings settings = new ServerConfigurationResolver().orcaRuntime();

        assertEquals("facility01", settings.facilityId());
        assertTrue(settings.cloudZero());
        assertTrue(settings.pvtListener().enabled());
        assertEquals("127.0.0.1", settings.pvtListener().bindIp());
        assertEquals(5001, settings.pvtListener().port());
    }

    @Test
    void copyStampTreeBuilderReturnsImmutableLists() throws Exception {
        CopyStampTreeBuilder builder = new CopyStampTreeBuilder();
        builder.buildStart();
        builder.buildRoot("root", "entity");
        builder.buildStampInfo("name", "role", "entity", "true", "memo", "seed-id");
        builder.buildRootEnd();
        builder.buildEnd();

        List<String> seeds = builder.getSeedStampList();
        List<open.dolphin.infomodel.StampModel> models = builder.getStampModelToPersist();

        assertEquals(List.of("seed-id"), seeds);
        assertEquals(1, models.size());
        assertThrows(UnsupportedOperationException.class, () -> seeds.add("mutated"));
        assertThrows(UnsupportedOperationException.class, () -> models.clear());
    }
}

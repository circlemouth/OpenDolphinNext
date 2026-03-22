package open.dolphin.rest.masterupdate;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import java.lang.reflect.Field;
import org.junit.jupiter.api.Test;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;

class MasterUpdateSchedulerTest {

    @Test
    void startReturnsWithoutSchedulerWhenDisabled() throws Exception {
        MasterUpdateScheduler scheduler = new MasterUpdateScheduler();
        ServerConfigurationResolver resolver = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_MASTER_UPDATE_SCHEDULER_ENABLED, "false");
        Field field = MasterUpdateScheduler.class.getDeclaredField("configurationResolver");
        field.setAccessible(true);
        field.set(scheduler, resolver);

        assertDoesNotThrow(scheduler::start);
    }
}

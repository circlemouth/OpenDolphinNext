package open.dolphin.rest.masterupdate;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.enterprise.concurrent.ManagedScheduledExecutorService;
import java.lang.reflect.Field;
import java.util.List;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
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

    @Test
    void startSchedulesDueLocalMasterCacheDatasetWhenEnabled() throws Exception {
        MasterUpdateScheduler scheduler = new MasterUpdateScheduler();
        ServerConfigurationResolver resolver = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_MASTER_UPDATE_SCHEDULER_ENABLED, "true");
        ManagedScheduledExecutorService executor = mock(ManagedScheduledExecutorService.class);
        @SuppressWarnings("unchecked")
        ScheduledFuture<Object> future = mock(ScheduledFuture.class);
        when(executor.scheduleAtFixedRate(any(Runnable.class), eq(15_000L), eq(60_000L),
                eq(TimeUnit.MILLISECONDS))).thenAnswer(invocation -> {
                    Runnable tick = invocation.getArgument(0, Runnable.class);
                    tick.run();
                    return future;
                });
        MasterUpdateService service = mock(MasterUpdateService.class);
        when(service.resolveDueDatasets()).thenReturn(List.of("local_orca_master_cache"));

        setField(scheduler, "configurationResolver", resolver);
        setField(scheduler, "scheduler", executor);
        setField(scheduler, "masterUpdateService", service);

        scheduler.start();

        verify(executor).scheduleAtFixedRate(any(Runnable.class), eq(15_000L), eq(60_000L),
                eq(TimeUnit.MILLISECONDS));
        verify(service).runAutoDatasetIfDue("local_orca_master_cache");
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

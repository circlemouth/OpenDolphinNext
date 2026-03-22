package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.mbean.PvtService;
import open.dolphin.worker.pvt.PvtSocketWorker;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PvtWorkerHealthResourceTest {

    @Mock
    private PvtService pvtService;

    @InjectMocks
    private PvtWorkerHealthResource resource;

    @Test
    void healthReturnsOkWhenStatusIsDisabled() {
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "DISABLED",
                "reasonCodes", List.of()));

        Response response = resource.health();

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(castBody(response).get("status")).isEqualTo("DISABLED");
        assertThat(castBody(response).get("reasonCodes")).isEqualTo(List.of());
    }

    @Test
    void healthReturnsServiceUnavailableWhenStatusIsDegradedWithFixedReasonCodes() {
        when(pvtService.workerHealthBody()).thenReturn(Map.of(
                "status", "DEGRADED",
                "reasonCodes", List.of(PvtService.REASON_CODE_PVT_QUEUE_OVER_CAPACITY)));

        Response response = resource.health();

        assertThat(response.getStatus()).isEqualTo(503);
        assertThat(castBody(response).get("status")).isEqualTo("DEGRADED");
        assertThat(castBody(response).get("reasonCodes"))
                .isEqualTo(List.of(PvtService.REASON_CODE_PVT_QUEUE_OVER_CAPACITY));
    }

    @Test
    void workerHealthBodyUsesFixedReasonCodes() throws Exception {
        TestPvtService service = new TestPvtService();
        service.snapshot = new PvtSocketWorker.RuntimeSnapshot(
                true,
                0L,
                0L,
                0L,
                0L,
                0L,
                0L,
                0L,
                1L,
                1,
                0L,
                System.currentTimeMillis(),
                0L,
                "",
                0L,
                0L,
                0,
                0,
                3,
                200,
                300_000L,
                200);
        setWorkerEnabled(service, true);

        Map<String, Object> body = service.workerHealthBody();

        assertThat(body.get("status")).isEqualTo("DEGRADED");
        assertThat(body.get("reasonCodes"))
                .isEqualTo(List.of(PvtService.REASON_CODE_PVT_QUEUE_OVER_CAPACITY));
    }

    @Test
    void registerIsSafeWhenLoggerLevelIsUnset() {
        Logger logger = Logger.getLogger("open.dolphin");
        Level originalLevel = logger.getLevel();
        TestPvtService service = new TestPvtService();

        try {
            logger.setLevel(null);

            assertDoesNotThrow(service::register);
        } finally {
            logger.setLevel(originalLevel);
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castBody(Response response) {
        return (Map<String, Object>) response.getEntity();
    }

    private static void setWorkerEnabled(PvtService service, boolean workerEnabled) throws Exception {
        Field field = PvtService.class.getDeclaredField("workerEnabled");
        field.setAccessible(true);
        field.set(service, workerEnabled);
    }

    private static final class TestPvtService extends PvtService {
        private PvtSocketWorker.RuntimeSnapshot snapshot = PvtSocketWorker.RuntimeSnapshot.disabled();

        @Override
        public void startService() {
            // no-op for logger-level safety verification
        }

        @Override
        public PvtSocketWorker.RuntimeSnapshot workerSnapshot() {
            return snapshot;
        }
    }
}

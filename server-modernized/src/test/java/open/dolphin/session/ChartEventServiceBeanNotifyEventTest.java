package open.dolphin.session;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Field;
import open.dolphin.infomodel.ChartEventModel;
import open.dolphin.session.support.ChartEventStreamPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ChartEventServiceBeanNotifyEventTest {

    private ChartEventServiceBean service;
    private ChartEventStreamPublisher publisher;

    @BeforeEach
    void setUp() throws Exception {
        service = new ChartEventServiceBean();
        publisher = mock(ChartEventStreamPublisher.class);
        setField(service, "chartEventStreamPublisher", publisher);
    }

    @Test
    void notifyEventBroadcastsToSse() {
        ChartEventModel event = event("F001", "issuer-1");

        service.notifyEvent(event);

        verify(publisher).broadcast(event);
    }

    private static ChartEventModel event(String facilityId, String issuerUuid) {
        ChartEventModel event = new ChartEventModel(issuerUuid);
        event.setFacilityId(facilityId);
        return event;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

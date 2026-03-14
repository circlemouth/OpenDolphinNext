package open.dolphin.session;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.AsyncContext;
import jakarta.servlet.ServletRequest;
import java.lang.reflect.Field;
import open.dolphin.infomodel.ChartEventModel;
import open.dolphin.mbean.ServletContextHolder;
import open.dolphin.session.support.ChartEventSessionKeys;
import open.dolphin.session.support.ChartEventStreamPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class ChartEventServiceBeanNotifyEventTest {

    private ChartEventServiceBean service;
    private ServletContextHolder contextHolder;
    private ChartEventStreamPublisher publisher;

    @BeforeEach
    void setUp() throws Exception {
        service = new ChartEventServiceBean();
        contextHolder = new ServletContextHolder();
        publisher = mock(ChartEventStreamPublisher.class);
        setField(service, "contextHolder", contextHolder);
        setField(service, "chartEventStreamPublisher", publisher);
    }

    @Test
    void notifyEventBroadcastsToSseEvenWhenNoLegacyAsyncContextExists() {
        ChartEventModel event = event("F001", "issuer-1");

        service.notifyEvent(event);

        verify(publisher).broadcast(event);
    }

    @Test
    void notifyEventKeepsLegacyAsyncFallbackAfterSseBroadcast() {
        ChartEventModel event = event("F001", "issuer-1");
        AsyncContext asyncContext = mock(AsyncContext.class);
        ServletRequest request = mock(ServletRequest.class);
        when(asyncContext.getRequest()).thenReturn(request);
        when(request.getAttribute(ChartEventSessionKeys.FACILITY_ID)).thenReturn("F001");
        when(request.getAttribute(ChartEventSessionKeys.CLIENT_UUID)).thenReturn("client-2");
        contextHolder.addAsyncContext(asyncContext);

        service.notifyEvent(event);

        InOrder inOrder = inOrder(publisher, asyncContext);
        inOrder.verify(publisher).broadcast(event);
        inOrder.verify(asyncContext).dispatch(ChartEventSessionKeys.DISPATCH_URL);
        verify(request).setAttribute(ChartEventSessionKeys.EVENT_ATTRIBUTE, event);
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

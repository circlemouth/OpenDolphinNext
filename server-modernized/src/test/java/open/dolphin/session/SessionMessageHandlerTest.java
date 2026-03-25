package open.dolphin.session;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.jms.Message;
import jakarta.jms.TextMessage;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SessionMessageHandlerTest {

    private SessionMessageHandler handler;
    private PVTServiceBean pvtServiceBean;

    @BeforeEach
    void setUp() throws Exception {
        handler = new SessionMessageHandler();
        pvtServiceBean = mock(PVTServiceBean.class);
        setField(handler, "pvtServiceBean", pvtServiceBean);
    }

    @Test
    void nonTextMessageIsRejectedWithoutProcessing() throws Exception {
        Message message = mock(Message.class);
        when(message.propertyExists(anyString())).thenReturn(false);

        handler.onMessage(message);

        verify(pvtServiceBean, never()).addPvt(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void malformedTextMessageIsRejectedWithoutProcessing() throws Exception {
        TextMessage message = mock(TextMessage.class);
        when(message.propertyExists(anyString())).thenReturn(false);
        when(message.getText()).thenReturn("{invalid-json");

        handler.onMessage(message);

        verify(pvtServiceBean, never()).addPvt(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void objectStylePayloadTypeIsRejectedWithoutProcessing() throws Exception {
        TextMessage message = mock(TextMessage.class);
        when(message.propertyExists(anyString())).thenReturn(false);
        when(message.getText()).thenReturn("{\"type\":\"UNSUPPORTED\",\"payload\":{\"k\":\"v\"}}");

        handler.onMessage(message);

        verify(pvtServiceBean, never()).addPvt(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void auditEnvelopeIsAcceptedWithoutPvtImport() throws Exception {
        TextMessage message = mock(TextMessage.class);
        when(message.propertyExists(anyString())).thenReturn(false);
        when(message.getText()).thenReturn(
                "{\"type\":\"AUDIT_EVENT\",\"audit\":{\"action\":\"ORCA_ACCEPT_LIST\",\"outcome\":\"SUCCESS\"}}");

        handler.onMessage(message);

        verify(pvtServiceBean, never()).addPvt(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void pvtEnvelopeWithBlankXmlIsRejectedWithoutProcessing() throws Exception {
        TextMessage message = mock(TextMessage.class);
        when(message.propertyExists(anyString())).thenReturn(false);
        when(message.getText()).thenReturn("{\"type\":\"PVT_XML\",\"pvtXml\":\"   \"}");

        handler.onMessage(message);

        verify(pvtServiceBean, never()).addPvt(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void configuredFacilityIdUsesResolverOnly() throws Exception {
        setField(handler, "configurationResolver",
                TestServerConfigurationResolvers.resolver("opendolphin.facility-id", "facility-123"));

        Method method = SessionMessageHandler.class.getDeclaredMethod("configuredFacilityId");
        method.setAccessible(true);
        Object resolved = method.invoke(handler);

        org.junit.jupiter.api.Assertions.assertEquals("facility-123", resolved);
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

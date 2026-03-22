package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.core.UriInfo;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.PatientImageServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import org.junit.jupiter.api.Test;

class PatientImagesSupportTest {

    @Test
    void safeFileNameForHeaderStripsHeaderInjectionCharacters() {
        PatientImagesSupport support = support();

        assertEquals("evil_.png", support.safeFileNameForHeader("evil\"\r\n.png", "fallback.png"));
    }

    @Test
    void buildDownloadUrlFallsBackWithoutUriInfo() {
        PatientImagesSupport support = support();

        assertEquals("/api/patients/*/images/10", support.buildDownloadUrl(10L));
    }

    private PatientImagesSupport support() {
        return new PatientImagesSupport(
                mock(HttpServletRequest.class),
                mock(HttpServletResponse.class),
                mock(UriInfo.class),
                mock(PatientServiceBean.class),
                mock(PatientImageServiceBean.class),
                mock(AuditTrailService.class),
                mock(UserServiceBean.class),
                mock(AttachmentStorageManager.class),
                TestServerConfigurationResolvers.resolver());
    }
}

package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.UriInfo;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.PatientImageServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.attachment.AttachmentStorageMode;
import org.junit.jupiter.api.Test;

class PatientImagesSupportTest {

    @Test
    void safeFileNameForHeaderStripsHeaderInjectionCharacters() {
        PatientImagesSupport support = support();

        assertEquals("evil_.png", support.safeFileNameForHeader("evil\"\r\n.png", "fallback.png"));
    }

    @Test
    void safeFileNameForHeaderStripsPathSegmentsAndControlCharacters() {
        PatientImagesSupport support = support();

        assertEquals("scan.png", support.safeFileNameForHeader("..\\nested/scan\u0001.png", "fallback.png"));
        assertEquals("fallback.png", support.safeFileNameForHeader("../", "fallback.png"));
    }

    @Test
    void buildDownloadUrlFallsBackWithoutUriInfo() {
        PatientImagesSupport support = support();

        assertEquals("/api/patients/*/images/10", support.buildDownloadUrl(10L));
    }

    @Test
    void requireStorageAvailableRejectsDisabledStorageWithSanitizedResponse() {
        AttachmentStorageManager storageManager = mock(AttachmentStorageManager.class);
        when(storageManager.getMode()).thenReturn(AttachmentStorageMode.DISABLED);
        PatientImagesSupport support = support(storageManager);

        WebApplicationException ex = assertThrows(WebApplicationException.class, support::requireStorageAvailable);

        assertEquals(503, ex.getResponse().getStatus());
    }

    private PatientImagesSupport support() {
        return support(mock(AttachmentStorageManager.class));
    }

    private PatientImagesSupport support(AttachmentStorageManager storageManager) {
        return new PatientImagesSupport(
                mock(HttpServletRequest.class),
                mock(HttpServletResponse.class),
                mock(UriInfo.class),
                mock(PatientServiceBean.class),
                mock(PatientImageServiceBean.class),
                mock(AuditTrailService.class),
                mock(UserServiceBean.class),
                storageManager,
                TestServerConfigurationResolvers.resolver());
    }
}

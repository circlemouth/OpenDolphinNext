package open.dolphin.rest;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import open.dolphin.rest.jackson.LegacyObjectMapperProducer;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PVTServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.session.framework.SessionTraceManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class KarteResourceDocinfoAllPagingTest {

    @Mock
    KarteServiceBean karteServiceBean;

    @Mock
    PVTServiceBean pvtServiceBean;

    @Mock
    AuditTrailService auditTrailService;

    @Mock
    SessionTraceManager sessionTraceManager;

    @Mock
    UserServiceBean userServiceBean;

    @Mock
    HttpServletRequest httpServletRequest;

    @Spy
    ObjectMapper objectMapper = new LegacyObjectMapperProducer().provideLegacyAwareMapper();

    @InjectMocks
    KarteResource resource;

    @BeforeEach
    void setUp() {
        when(httpServletRequest.getRemoteUser()).thenReturn("FAC_A:user01");
        when(karteServiceBean.findFacilityIdByPatientPk(1001L)).thenReturn("FAC_A");
    }

    @Test
    void getAllDocumentUsesDefaultPagingWhenQueryIsMissing() {
        resource.getAllDocument("1001", null, null);

        verify(karteServiceBean).getAllDocument(1001L, 0, KarteServiceBean.DEFAULT_DOCINFO_PAGE_SIZE);
    }

    @Test
    void getAllDocumentNormalizesOffsetAndLimit() {
        resource.getAllDocument("1001", -5, 999);

        verify(karteServiceBean).getAllDocument(1001L, 0, KarteServiceBean.MAX_DOCINFO_PAGE_SIZE);
    }
}

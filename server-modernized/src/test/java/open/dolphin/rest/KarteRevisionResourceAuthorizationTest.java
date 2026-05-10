package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.time.LocalDate;
import open.dolphin.rest.jackson.LegacyObjectMapperProducer;
import open.dolphin.security.audit.AuthoritativeAuditRepository;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.KarteRevisionServiceBean;
import open.dolphin.session.framework.SessionTraceManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class KarteRevisionResourceAuthorizationTest {

    @Mock
    KarteRevisionServiceBean karteRevisionServiceBean;

    @Mock
    AuditTrailService auditTrailService;

    @Mock
    AuthoritativeAuditRepository authoritativeAuditRepository;

    @Mock
    SessionTraceManager sessionTraceManager;

    @Mock
    HttpServletRequest httpServletRequest;

    @Spy
    ObjectMapper objectMapper = new LegacyObjectMapperProducer().provideLegacyAwareMapper();

    @InjectMocks
    KarteRevisionResource resource;

    @Test
    void historyReturnsForbiddenForCrossFacilityKarte() {
        when(httpServletRequest.getRemoteUser()).thenReturn("FAC_A:user01");
        when(karteRevisionServiceBean.findFacilityIdByKarteId(10L)).thenReturn("FAC_B");

        assertForbidden(() -> resource.getHistory(10L, "2026-03-01"));
        verify(karteRevisionServiceBean, never()).getRevisionHistory(anyLong(), any(LocalDate.class));
    }

    @Test
    void getRevisionReturnsForbiddenForCrossFacilityRevisionId() {
        when(httpServletRequest.getRemoteUser()).thenReturn("FAC_A:user01");
        when(karteRevisionServiceBean.findFacilityIdByRevisionId(111L)).thenReturn("FAC_B");

        assertForbidden(() -> resource.getRevision(111L));
        verify(karteRevisionServiceBean, never()).getRevisionSnapshotLight(anyLong());
    }

    @Test
    void diffReturnsForbiddenForCrossFacilityRevisionId() {
        when(httpServletRequest.getRemoteUser()).thenReturn("FAC_A:user01");
        when(karteRevisionServiceBean.findFacilityIdByRevisionId(111L)).thenReturn("FAC_B");

        assertForbidden(() -> resource.diff(111L, 222L));
        verify(karteRevisionServiceBean, never()).diffRevisions(anyLong(), anyLong());
    }

    @Test
    void reviseReturnsForbiddenForCrossFacilityRevisionId() {
        when(httpServletRequest.getRemoteUser()).thenReturn("FAC_A:user01");
        when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(true);
        when(karteRevisionServiceBean.findFacilityIdByRevisionId(222L)).thenReturn("FAC_B");

        assertForbidden(() -> resource.revise("{\"sourceRevisionId\":222,\"baseRevisionId\":222}", null));
        verify(karteRevisionServiceBean, never()).getRevisionSnapshot(anyLong());
    }

    @Test
    void reviseReturnsServiceUnavailableWhenAuditWritePathIsUnavailable() {
        when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(false);

        assertThatThrownBy(() -> resource.revise("{\"sourceRevisionId\":222,\"baseRevisionId\":222}", null))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(503));
        verify(karteRevisionServiceBean, never()).findFacilityIdByRevisionId(anyLong());
        verify(karteRevisionServiceBean, never()).getRevisionSnapshot(anyLong());
    }

    private static void assertForbidden(org.assertj.core.api.ThrowableAssert.ThrowingCallable callable) {
        assertThatThrownBy(callable)
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(403));
    }
}

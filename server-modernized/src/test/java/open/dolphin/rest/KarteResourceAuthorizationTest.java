package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.util.Date;
import java.util.List;
import open.dolphin.converter.SchemaModelConverter;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.UserPropertyResponse;
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
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class KarteResourceAuthorizationTest {

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

    @InjectMocks
    KarteResource resource;

    @BeforeEach
    void setUp() {
        when(httpServletRequest.getRemoteUser()).thenReturn("FAC_A:user01");
    }

    @Test
    void getImageAllowsSameFacilitySchema() {
        SchemaModel schema = new SchemaModel();
        schema.setId(55L);
        KarteBean karteBean = new KarteBean();
        karteBean.setId(501L);
        schema.setKarteBean(karteBean);
        UserModel userModel = new UserModel();
        userModel.setId(601L);
        schema.setUserModel(userModel);
        when(karteServiceBean.findFacilityIdBySchemaId(55L)).thenReturn("FAC_A");
        when(karteServiceBean.getImage(55L)).thenReturn(schema);

        SchemaModelConverter result = resource.getImage(httpServletRequest, "55");

        assertThat(result.getId()).isEqualTo(55L);
        verify(karteServiceBean).getImage(55L);
    }

    @Test
    void getImageRejectsCrossFacilitySchema() {
        when(karteServiceBean.findFacilityIdBySchemaId(55L)).thenReturn("FAC_B");

        assertForbidden(() -> resource.getImage(httpServletRequest, "55"));
        verify(karteServiceBean, never()).getImage(55L);
    }

    @Test
    void deleteObservationsAllowsSameFacilityIds() {
        when(karteServiceBean.findFacilityIdByObservationId(21L)).thenReturn("FAC_A");
        when(karteServiceBean.findFacilityIdByObservationId(22L)).thenReturn("FAC_A");
        when(karteServiceBean.removeObservations(List.of(21L, 22L))).thenReturn(2);

        resource.deleteObservations("21,22");

        verify(karteServiceBean).removeObservations(List.of(21L, 22L));
    }

    @Test
    void deleteObservationsRejectsWholeBatchOnCrossFacilityId() {
        when(karteServiceBean.findFacilityIdByObservationId(21L)).thenReturn("FAC_A");
        when(karteServiceBean.findFacilityIdByObservationId(22L)).thenReturn("FAC_B");

        assertForbidden(() -> resource.deleteObservations("21,22"));
        verify(karteServiceBean, never()).removeObservations(anyList());
    }

    @Test
    void nullResolvedFacilityIsRejectedFailClosed() {
        when(karteServiceBean.findFacilityIdBySchemaId(55L)).thenReturn(null);

        assertForbidden(() -> resource.getImage(httpServletRequest, "55"));
        verify(karteServiceBean, never()).getImage(anyLong());
    }

    @Test
    void getDocumentListReturnsForbiddenForCrossFacilityKarteId() {
        when(karteServiceBean.findFacilityIdByKarteId(200L)).thenReturn("FAC_B");

        assertForbidden(() -> resource.getDocumentList(httpServletRequest, "200,2026-03-01 00:00:00,false"));
        verify(karteServiceBean, never()).getDocumentList(anyLong(), any(Date.class), anyBoolean());
    }

    @Test
    void getDocumentsReturnsForbiddenForCrossFacilityDocId() {
        when(karteServiceBean.findFacilityIdByDocId(300L)).thenReturn("FAC_B");

        assertForbidden(() -> resource.getDocuments("300"));
        verify(karteServiceBean, never()).getDocuments(anyList());
    }

    @Test
    void getUserPropertiesAllowsSelfByCompositeUserId() {
        List<UserPropertyResponse> responses = List.of(new UserPropertyResponse(1L, "department", "内科", null, null, null));
        when(userServiceBean.isAdmin("FAC_A:user01")).thenReturn(false);
        when(karteServiceBean.getUserProperties("FAC_A:user01")).thenReturn(responses);

        List<UserPropertyResponse> result = resource.getUserProperties(httpServletRequest, "FAC_A:user01");

        assertThat(result).containsExactlyElementsOf(responses);
        verify(karteServiceBean).getUserProperties("FAC_A:user01");
    }

    @Test
    void getUserPropertiesAllowsSelfByBareUserId() {
        List<UserPropertyResponse> responses = List.of(new UserPropertyResponse(2L, "orcaId", "1001", null, null, null));
        when(userServiceBean.isAdmin("FAC_A:user01")).thenReturn(false);
        when(karteServiceBean.getUserProperties("FAC_A:user01")).thenReturn(responses);

        List<UserPropertyResponse> result = resource.getUserProperties(httpServletRequest, "user01");

        assertThat(result).containsExactlyElementsOf(responses);
        verify(karteServiceBean).getUserProperties("FAC_A:user01");
    }

    @Test
    void getUserPropertiesRejectsOtherUserForNonAdmin() {
        when(userServiceBean.isAdmin("FAC_A:user01")).thenReturn(false);

        assertForbidden(() -> resource.getUserProperties(httpServletRequest, "doctor02"));
        verify(karteServiceBean, never()).getUserProperties(any());
    }

    @Test
    void getUserPropertiesAllowsSameFacilityAdmin() {
        List<UserPropertyResponse> responses = List.of(new UserPropertyResponse(3L, "memo", "test", null, null, null));
        when(userServiceBean.isAdmin("FAC_A:user01")).thenReturn(true);
        when(karteServiceBean.getUserProperties("FAC_A:doctor02")).thenReturn(responses);

        List<UserPropertyResponse> result = resource.getUserProperties(httpServletRequest, "doctor02");

        assertThat(result).containsExactlyElementsOf(responses);
        verify(karteServiceBean).getUserProperties("FAC_A:doctor02");
    }

    @Test
    void getUserPropertiesRejectsCrossFacilityAdminTarget() {
        when(userServiceBean.isAdmin("FAC_A:user01")).thenReturn(true);

        assertForbidden(() -> resource.getUserProperties(httpServletRequest, "FAC_B:doctor02"));
        verify(karteServiceBean, never()).getUserProperties(any());
    }

    @Test
    void getUserPropertiesRequiresAuthenticatedActor() {
        when(httpServletRequest.getRemoteUser()).thenReturn(null);

        assertThatThrownBy(() -> resource.getUserProperties(httpServletRequest, "user01"))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(401));
        verify(karteServiceBean, never()).getUserProperties(any());
    }

    private static void assertForbidden(org.assertj.core.api.ThrowableAssert.ThrowingCallable callable) {
        assertThatThrownBy(callable)
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(403));
    }
}

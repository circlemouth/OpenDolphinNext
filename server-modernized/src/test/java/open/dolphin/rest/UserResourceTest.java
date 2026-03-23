package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.util.List;
import open.dolphin.infomodel.FacilityModel;
import open.dolphin.infomodel.RoleModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.CurrentUserResponse;
import open.dolphin.session.UserServiceBean;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserResourceTest extends RuntimeDelegateTestSupport {

    private static final String USER_01 = "F001:user01";
    private static final String USER_02 = "F001:user02";
    private static final String ADMIN = "F001:admin";
    private static final String SYSTEM_ADMIN = "F009:root";

    @Mock
    private UserServiceBean userServiceBean;

    @Mock
    private HttpServletRequest request;

    private UserResource resource;

    @BeforeEach
    void setUp() throws Exception {
        resource = new UserResource();
        setField(resource, "userServiceBean", userServiceBean);
    }

    @Test
    void getUserReturnsSafeDtoWithoutSensitiveFields() throws Exception {
        UserModel user = userWithRole(USER_01, "F001", 1L, "user");
        user.setPassword("secret");
        user.setMemo("internal memo");
        user.setOrcaId("orca-01");
        user.setUseDrugId("drug-01");

        when(request.getRemoteUser()).thenReturn(USER_01);
        when(userServiceBean.getUser(USER_01)).thenReturn(user);

        CurrentUserResponse response = resource.getUser(request, USER_01);
        String json = new ObjectMapper().writeValueAsString(response);
        assertThat(json)
                .doesNotContain("password")
                .doesNotContain("temporaryPassword")
                .doesNotContain("credential")
                .doesNotContain("hash")
                .doesNotContain("salt")
                .doesNotContain("memo")
                .doesNotContain("orcaId")
                .doesNotContain("useDrugId");
    }

    @Test
    void getUserReturns404WhenRequestingOtherUserWithoutAdmin() {
        when(request.getRemoteUser()).thenReturn(USER_01);
        when(userServiceBean.getUser(USER_02)).thenReturn(userWithRole(USER_02, "F001", 2L, "user"));
        when(userServiceBean.isAdmin(USER_01)).thenReturn(false);

        assertThatThrownBy(() -> resource.getUser(request, USER_02))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(404));
    }

    @Test
    void getUserNameRequiresAuthentication() {
        when(request.getRemoteUser()).thenReturn(null);

        assertThatThrownBy(() -> resource.getUserName(request, USER_02))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(401));
    }

    @Test
    void getUserNameReturns404ForOtherUserWithoutAdmin() {
        when(request.getRemoteUser()).thenReturn(USER_01);
        when(userServiceBean.isAdmin(USER_01)).thenReturn(false);

        assertThatThrownBy(() -> resource.getUserName(request, USER_02))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(404));
    }

    @Test
    void sameFacilityAdminCanReadOtherUserName() throws Exception {
        when(request.getRemoteUser()).thenReturn(ADMIN);
        when(userServiceBean.isAdmin(ADMIN)).thenReturn(true);
        when(userServiceBean.getUserName(USER_02)).thenReturn("User Two");

        assertThat(resource.getUserName(request, USER_02)).isEqualTo("User Two");
    }

    @Test
    void postUserRejectsFactor2AuthInputBeforeAdminCheck() throws Exception {
        String payload = """
                {
                  "userId":"F001:user03",
                  "commonName":"New User",
                  "factor2Auth":"totp",
                  "roles":[{"role":"user"}]
                }
                """;

        assertThatThrownBy(() -> resource.postUser(request, payload))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(400));

        verify(userServiceBean, never()).addUser(any());
    }

    @Test
    void nonAdminCannotUpdateOtherUser() throws Exception {
        when(request.getRemoteUser()).thenReturn(USER_01);
        when(userServiceBean.isAdmin(USER_01)).thenReturn(false);
        when(userServiceBean.getUserByPk(2L)).thenReturn(userWithRole(USER_02, "F001", 2L, "user"));

        String payload = """
                {
                  "id":2,
                  "userId":"F001:user02",
                  "commonName":"Other User",
                  "roles":[{"role":"user"}]
                }
                """;

        assertThatThrownBy(() -> resource.putUser(request, payload))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(403));

        verify(userServiceBean, never()).updateUser(any());
    }

    @Test
    void putUserRejectsFactor2AuthInput() throws Exception {
        String payload = """
                {
                  "id":1,
                  "userId":"F001:user01",
                  "commonName":"Self Update",
                  "factor2Auth":"totp",
                  "roles":[{"role":"user"}]
                }
                """;

        assertThatThrownBy(() -> resource.putUser(request, payload))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(400));

        verify(userServiceBean, never()).updateUser(any());
    }

    @Test
    void nonAdminCanUpdateOwnProfileWhenRolesUnchanged() throws Exception {
        when(request.getRemoteUser()).thenReturn(USER_01);
        when(userServiceBean.isAdmin(USER_01)).thenReturn(false);

        UserModel current = userWithRole(USER_01, "F001", 1L, "user");
        when(userServiceBean.getUserByPk(1L)).thenReturn(current);
        when(userServiceBean.updateUser(any(UserModel.class))).thenReturn(1);

        String payload = """
                {
                  "id":1,
                  "userId":"F999:spoofed",
                  "commonName":"Self Update",
                  "facilityModel":{"id":99,"facilityId":"F999"},
                  "roles":[{"role":"user"}]
                }
                """;

        String result = resource.putUser(request, payload);

        assertThat(result).isEqualTo("1");
        ArgumentCaptor<UserModel> captor = ArgumentCaptor.forClass(UserModel.class);
        verify(userServiceBean).updateUser(captor.capture());
        UserModel updated = captor.getValue();
        assertThat(updated.getUserId()).isEqualTo("F001:spoofed");
        assertThat(updated.getFacilityModel().getFacilityId()).isEqualTo("F001");
    }

    @Test
    void nonAdminCannotChangeRoles() throws Exception {
        when(request.getRemoteUser()).thenReturn(USER_01);
        when(userServiceBean.isAdmin(USER_01)).thenReturn(false);
        when(userServiceBean.getUserByPk(1L)).thenReturn(userWithRole(USER_01, "F001", 1L, "user"));

        String payload = """
                {
                  "id":1,
                  "userId":"F001:user01",
                  "commonName":"Self Update",
                  "roles":[{"role":"admin"}]
                }
                """;

        assertThatThrownBy(() -> resource.putUser(request, payload))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(403));
        verify(userServiceBean, never()).updateUser(any());
    }

    @Test
    void sameFacilityAdminCanUpdateAndDeleteUser() throws Exception {
        when(request.getRemoteUser()).thenReturn(ADMIN);
        when(userServiceBean.isAdmin(ADMIN)).thenReturn(true);
        when(userServiceBean.getUserByPk(2L)).thenReturn(userWithRole(USER_02, "F001", 2L, "user"));
        when(userServiceBean.getUser(USER_02)).thenReturn(userWithRole(USER_02, "F001", 2L, "user"));
        when(userServiceBean.updateUser(any(UserModel.class))).thenReturn(1);

        String payload = """
                {
                  "id":2,
                  "userId":"F999:user02-moved",
                  "commonName":"Managed User",
                  "facilityModel":{"id":200,"facilityId":"F999"},
                  "roles":[{"role":"admin"}]
                }
                """;

        String result = resource.putUser(request, payload);
        resource.deleteUser(request, USER_02);

        assertThat(result).isEqualTo("1");
        ArgumentCaptor<UserModel> captor = ArgumentCaptor.forClass(UserModel.class);
        verify(userServiceBean).updateUser(captor.capture());
        UserModel updated = captor.getValue();
        assertThat(updated.getUserId()).isEqualTo("F001:user02-moved");
        assertThat(updated.getFacilityModel().getFacilityId()).isEqualTo("F001");
        verify(userServiceBean).removeUser(USER_02);
    }

    @Test
    void crossFacilityAdminCannotUpdateOrDeleteUser() throws Exception {
        when(request.getRemoteUser()).thenReturn(ADMIN);
        when(userServiceBean.isAdmin(ADMIN)).thenReturn(true);
        when(userServiceBean.getUserByPk(2L)).thenReturn(userWithRole(USER_02, "F999", 2L, "user"));
        when(userServiceBean.getUser(USER_02)).thenReturn(userWithRole(USER_02, "F999", 2L, "user"));

        String payload = """
                {
                  "id":2,
                  "userId":"F999:user02",
                  "commonName":"Managed User",
                  "roles":[{"role":"admin"}]
                }
                """;

        assertThatThrownBy(() -> resource.putUser(request, payload))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(404));
        assertThatThrownBy(() -> resource.deleteUser(request, USER_02))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(404));

        verify(userServiceBean, never()).updateUser(any());
        verify(userServiceBean, never()).removeUser(USER_02);
    }

    @Test
    void sameFacilityAdminCanUpdateFacilityWithActorFacilityNormalization() throws Exception {
        when(request.getRemoteUser()).thenReturn(ADMIN);
        when(userServiceBean.isAdmin(ADMIN)).thenReturn(true);
        when(userServiceBean.getFacilityByPk(10L)).thenReturn(facility("F001", 10L));
        when(userServiceBean.updateFacility(any(UserModel.class))).thenReturn(1);

        String payload = """
                {
                  "facilityModel":{"id":10,"facilityId":"F999","facilityName":"Updated"}
                }
                """;

        String result = resource.putFacility(request, payload);

        assertThat(result).isEqualTo("1");
        ArgumentCaptor<UserModel> captor = ArgumentCaptor.forClass(UserModel.class);
        verify(userServiceBean).updateFacility(captor.capture());
        assertThat(captor.getValue().getFacilityModel().getFacilityId()).isEqualTo("F001");
    }

    @Test
    void putFacilityRejectsFactor2AuthInput() {
        String payload = """
                {
                  "facilityModel":{"id":10,"facilityId":"F001","facilityName":"Updated"},
                  "factor2Auth":"totp"
                }
                """;

        assertThatThrownBy(() -> resource.putFacility(request, payload))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(400));

        verify(userServiceBean, never()).updateFacility(any());
    }

    @Test
    void crossFacilityAdminCannotUpdateFacility() {
        when(request.getRemoteUser()).thenReturn(ADMIN);
        when(userServiceBean.isAdmin(ADMIN)).thenReturn(true);
        when(userServiceBean.getFacilityByPk(10L)).thenReturn(facility("F999", 10L));

        String payload = """
                {
                  "facilityModel":{"id":10,"facilityId":"F999","facilityName":"Updated"}
                }
                """;

        assertThatThrownBy(() -> resource.putFacility(request, payload))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(404));
        verify(userServiceBean, never()).updateFacility(any());
    }

    @Test
    void systemAdminDoesNotBypassFacilityBoundary() throws Exception {
        when(request.getRemoteUser()).thenReturn(SYSTEM_ADMIN);
        lenient().when(userServiceBean.getUserByPk(2L)).thenReturn(userWithRole(USER_02, "F001", 2L, "user"));

        String payload = """
                {
                  "id":2,
                  "userId":"F001:user02",
                  "commonName":"Managed User",
                  "roles":[{"role":"user"}]
                }
                """;

        assertThatThrownBy(() -> resource.putUser(request, payload))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(ex -> assertThat(((WebApplicationException) ex).getResponse().getStatus()).isEqualTo(404));
        verify(userServiceBean, never()).updateUser(any());
    }

    private static RoleModel role(String value) {
        RoleModel role = new RoleModel();
        role.setRole(value);
        return role;
    }

    private static FacilityModel facility(String facilityId, long id) {
        FacilityModel facility = new FacilityModel();
        facility.setId(id);
        facility.setFacilityId(facilityId);
        return facility;
    }

    private static UserModel userWithRole(String userId, String facilityId, long id, String roleValue) {
        UserModel user = new UserModel();
        user.setId(id);
        user.setUserId(userId);
        user.setPassword("secret");
        user.setFacilityModel(facility(facilityId, id + 100));
        user.setRoles(List.of(role(roleValue)));
        return user;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        var field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

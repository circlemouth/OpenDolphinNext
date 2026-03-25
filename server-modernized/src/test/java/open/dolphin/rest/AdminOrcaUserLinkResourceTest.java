package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.security.auth.AdminStepUpGuard;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.UserServiceBean;
import open.dolphin.infomodel.UserModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AdminOrcaUserLinkResourceTest {

    private AdminOrcaUserLinkResource resource;
    private HttpServletRequest request;
    private UserServiceBean userServiceBean;
    private OrcaTransport orcaTransport;
    private EntityManager em;

    @BeforeEach
    void setUp() throws Exception {
        resource = new AdminOrcaUserLinkResource();
        request = mock(HttpServletRequest.class);
        userServiceBean = mock(UserServiceBean.class);
        orcaTransport = mock(OrcaTransport.class);
        em = mock(EntityManager.class);

        setField(resource, AdminOrcaUserResource.class, "userServiceBean", userServiceBean);
        setField(resource, AdminOrcaUserResource.class, "orcaTransport", orcaTransport);
        setField(resource, AdminOrcaUserResource.class, "adminStepUpGuard", mock(AdminStepUpGuard.class));
        setField(resource, AdminOrcaUserResource.class, "sessionAuditDispatcher", mock(SessionAuditDispatcher.class));
        setField(resource, AdminOrcaUserResource.class, "em", em);

        when(request.getRemoteUser()).thenReturn("F001:admin");
        when(userServiceBean.isAdmin("F001:admin")).thenReturn(true);
        when(orcaTransport.invoke(anyString(), eq(OrcaEndpoint.MANAGE_USERS), org.mockito.ArgumentMatchers.any(OrcaTransportRequest.class)))
                .thenReturn(okManageUsersResponse());
    }

    @Test
    void linkUsesFacilityNativeLookupAndUpsert() {
        Query tableQuery = chainableQuery(List.of(1));
        Query ownerQuery = chainableQuery(List.of());
        Query upsertQuery = chainableQuery(List.of());
        when(em.createNativeQuery(org.mockito.ArgumentMatchers.contains("information_schema.tables"))).thenReturn(tableQuery);
        when(em.createNativeQuery(org.mockito.ArgumentMatchers.contains("where facility_id=:facilityId and orca_user_id=:orcaUserId")))
                .thenReturn(ownerQuery);
        when(em.createNativeQuery(org.mockito.ArgumentMatchers.contains("insert into opendolphin.d_orca_user_link (facility_id, ehr_user_pk, orca_user_id")))
                .thenReturn(upsertQuery);

        UserModel user = new UserModel();
        user.setId(10L);
        user.setUserId("F001:doctor");
        when(userServiceBean.getUser("F001:doctor")).thenReturn(user);

        Response response = resource.linkEhrUserToOrcaEndpoint(request, "doctor", Map.of("orcaUserId", "orca_01"));

        assertEquals(200, response.getStatus());
        verify(ownerQuery).setParameter("facilityId", "F001");
        verify(upsertQuery).setParameter("facilityId", "F001");
    }

    @Test
    void unlinkUsesFacilityNativeDelete() {
        Query tableQuery = chainableQuery(List.of(1));
        Query deleteQuery = chainableQuery(List.of());
        when(em.createNativeQuery(org.mockito.ArgumentMatchers.contains("information_schema.tables"))).thenReturn(tableQuery);
        when(em.createNativeQuery(org.mockito.ArgumentMatchers.contains("delete from opendolphin.d_orca_user_link where facility_id=:facilityId and ehr_user_pk=:ehrUserPk")))
                .thenReturn(deleteQuery);

        UserModel user = new UserModel();
        user.setId(10L);
        user.setUserId("F001:doctor");
        when(userServiceBean.getUser("F001:doctor")).thenReturn(user);

        Response response = resource.unlinkEhrUserFromOrcaEndpoint(request, "doctor");

        assertEquals(200, response.getStatus());
        verify(deleteQuery).setParameter("facilityId", "F001");
    }

    private Query chainableQuery(List<?> resultList) {
        Query query = mock(Query.class);
        when(query.setMaxResults(org.mockito.ArgumentMatchers.anyInt())).thenReturn(query);
        when(query.setParameter(anyString(), org.mockito.ArgumentMatchers.any())).thenReturn(query);
        when(query.getResultList()).thenReturn(resultList);
        when(query.executeUpdate()).thenReturn(1);
        return query;
    }

    private OrcaTransportResult okManageUsersResponse() {
        String xml = """
                <data>
                  <manageusersres type=\"record\">
                    <Api_Result type=\"string\">0000</Api_Result>
                    <Api_Result_Message type=\"string\">OK</Api_Result_Message>
                    <User_Information type=\"array\">
                      <User_Information_child type=\"record\">
                        <User_Id type=\"string\">orca_01</User_Id>
                        <Full_Name type=\"string\">ORCA Taro</Full_Name>
                      </User_Information_child>
                    </User_Information>
                  </manageusersres>
                </data>
                """;
        return new OrcaTransportResult(
                "https://weborca-trial.orca.med.or.jp/api01rv2/manageusersv2",
                "POST",
                200,
                xml,
                "application/xml",
                Map.of());
    }

    private static void setField(Object target, Class<?> owner, String name, Object value) throws Exception {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }
}

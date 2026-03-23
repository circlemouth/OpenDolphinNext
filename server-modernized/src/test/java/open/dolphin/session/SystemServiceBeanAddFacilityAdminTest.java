package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.Query;
import java.lang.reflect.Field;
import java.util.List;
import open.dolphin.infomodel.FacilityModel;
import open.dolphin.infomodel.RoleModel;
import open.dolphin.infomodel.UserModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SystemServiceBeanAddFacilityAdminTest {

    private static final String QUERY_NEXT_FID = "select nextval('facility_num') as n";
    private static final String QUERY_FACILITY_BY_FID = "from FacilityModel f where f.facilityId=:fid";

    private SystemServiceBean service;
    private EntityManager em;
    private Query nextIdQuery;
    private Query facilityQuery;
    private UserModel user;
    private FacilityModel facility;
    private RoleModel role;

    @BeforeEach
    void setUp() throws Exception {
        service = new SystemServiceBean();
        em = mock(EntityManager.class);
        nextIdQuery = mock(Query.class);
        facilityQuery = mock(Query.class);
        facility = new FacilityModel();
        facility.setFacilityName("Alpha Clinic");
        facility.setAddress("Tokyo");
        facility.setTelephone("03-0000-0001");
        facility.setZipCode("100-0001");
        facility.setUrl("https://alpha.example");
        role = new RoleModel();
        role.setRole("admin");
        user = new UserModel();
        user.setUserId("manager01");
        user.setCommonName("Manager");
        user.setEmail("manager@example.com");
        user.setFacilityModel(facility);
        user.setRoles(List.of(role));

        setField(service, "em", em);
        when(em.createNativeQuery(QUERY_NEXT_FID)).thenReturn(nextIdQuery);
        when(nextIdQuery.getSingleResult()).thenReturn(7L);
        when(em.createQuery(QUERY_FACILITY_BY_FID)).thenReturn(facilityQuery);
        when(facilityQuery.setParameter(anyString(), any())).thenReturn(facilityQuery);
        when(facilityQuery.getSingleResult()).thenThrow(new NoResultException());
        doAnswer(invocation -> {
            Object target = invocation.getArgument(0);
            if (target instanceof UserModel persistedUser && persistedUser.getId() == 0L) {
                persistedUser.setId(11L);
            }
            if (target instanceof FacilityModel persistedFacility && persistedFacility.getId() == 0L) {
                persistedFacility.setId(22L);
            }
            return null;
        }).when(em).persist(any());
    }

    @Test
    void addFacilityAdmin_registersFacilityWithoutSeedArtifacts() {
        AccountSummary summary = service.addFacilityAdmin(user);

        assertThat(summary.getFacilityId()).isEqualTo("1.3.6.1.4.1.9414.72.7");
        assertThat(summary.getFacilityName()).isEqualTo("Alpha Clinic");
        assertThat(summary.getFacilityAddress()).isEqualTo("Tokyo");
        assertThat(summary.getUserId()).isEqualTo("manager01");
        assertThat(user.getUserId()).isEqualTo("1.3.6.1.4.1.9414.72.7:manager01");
        assertThat(role.getUserId()).isEqualTo("1.3.6.1.4.1.9414.72.7:manager01");
        verify(em).persist(facility);
        verify(em).persist(user);
        verify(em).persist(role);
    }

    @Test
    void addFacilityAdmin_rejectsWhenFacilityAlreadyExists() {
        doReturn(new Object()).when(facilityQuery).getSingleResult();

        assertThatThrownBy(() -> service.addFacilityAdmin(user))
                .isInstanceOf(jakarta.persistence.EntityExistsException.class);
        verify(em, never()).persist(user);
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

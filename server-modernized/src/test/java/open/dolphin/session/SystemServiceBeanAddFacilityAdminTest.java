package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_SELF;
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
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import open.dolphin.infomodel.FacilityModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.RoleModel;
import open.dolphin.infomodel.StampModel;
import open.dolphin.infomodel.StampTreeModel;
import open.dolphin.infomodel.UserModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SystemServiceBeanAddFacilityAdminTest {

    private static final String QUERY_NEXT_FID = "select nextval('facility_num') as n";
    private static final String QUERY_FACILITY_BY_FID = "from FacilityModel f where f.facilityId=:fid";
    private static final String QUERY_PATIENT_BY_FID = "from PatientModel p where p.facilityId=:fid order by p.patientId";
    private static final String QUERY_USER_BY_UID = "from UserModel u where u.userId=:uid";
    private static final String QUERY_STAMP_TREE_BY_USER_PK = "from StampTreeModel s where s.user.id=:userPK";

    private SystemServiceBean service;
    private EntityManager em;
    private Query nextIdQuery;
    private Query facilityQuery;
    private Query patientQuery;
    private Query adminQuery;
    private Query stampTreeQuery;
    private UserModel user;
    private FacilityModel facility;
    private RoleModel role;

    @BeforeEach
    void setUp() throws Exception {
        service = new SystemServiceBean();
        em = mock(EntityManager.class);
        nextIdQuery = mock(Query.class, RETURNS_SELF);
        facilityQuery = mock(Query.class, RETURNS_SELF);
        patientQuery = mock(Query.class, RETURNS_SELF);
        adminQuery = mock(Query.class, RETURNS_SELF);
        stampTreeQuery = mock(Query.class, RETURNS_SELF);
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
        when(em.createQuery(QUERY_PATIENT_BY_FID)).thenReturn(patientQuery);
        when(patientQuery.setParameter(anyString(), any())).thenReturn(patientQuery);
        when(patientQuery.setFirstResult(anyInt())).thenReturn(patientQuery);
        when(patientQuery.setMaxResults(anyInt())).thenReturn(patientQuery);
        when(patientQuery.getResultList()).thenReturn(List.of());
        when(em.createQuery(QUERY_USER_BY_UID)).thenReturn(adminQuery);
        when(adminQuery.setParameter(anyString(), any())).thenReturn(adminQuery);
        UserModel admin = new UserModel();
        admin.setId(99L);
        admin.setUserId("1.3.6.1.4.1.9414.70.1:admin");
        when(adminQuery.getSingleResult()).thenReturn(admin);
        when(em.createQuery(QUERY_STAMP_TREE_BY_USER_PK)).thenReturn(stampTreeQuery);
        when(stampTreeQuery.setParameter(anyString(), any())).thenReturn(stampTreeQuery);
        when(stampTreeQuery.getResultList()).thenReturn(new ArrayList<>(List.of(stampTree())));
        when(em.find(StampModel.class, "seed-1")).thenReturn(seedStamp());
        doAnswer(invocation -> {
            Object target = invocation.getArgument(0);
            if (target instanceof UserModel persistedUser && persistedUser.getId() == 0L) {
                persistedUser.setId(11L);
            }
            if (target instanceof FacilityModel persistedFacility && persistedFacility.getId() == 0L) {
                persistedFacility.setId(22L);
            }
            if (target instanceof StampTreeModel persistedTree && persistedTree.getId() == 0L) {
                persistedTree.setId(33L);
            }
            if (target instanceof StampModel persistedStamp && persistedStamp.getId() == null) {
                persistedStamp.setId("persisted-stamp");
            }
            return null;
        }).when(em).persist(any());
    }

    @Test
    void addFacilityAdmin_registersFacilityAndCopiesSeedArtifacts() {
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
        verify(em).persist(any(StampTreeModel.class));
        verify(em).persist(any(StampModel.class));
    }

    @Test
    void addFacilityAdmin_rejectsWhenFacilityAlreadyExists() {
        doReturn(new Object()).when(facilityQuery).getSingleResult();

        assertThatThrownBy(() -> service.addFacilityAdmin(user))
                .isInstanceOf(jakarta.persistence.EntityExistsException.class);
        verify(em, never()).persist(user);
    }

    private static StampTreeModel stampTree() {
        StampTreeModel tree = new StampTreeModel();
        tree.setId(55L);
        tree.setTreeBytes(("""
                <?xml version="1.0" encoding="UTF-8"?>
                <stampBox project="open.dolphin" version="1.0">
                  <root name="root" entity="entity">
                    <stampInfo name="name" role="role" entity="entity" editable="true" memo="memo" stampId="seed-1"/>
                  </root>
                </stampBox>
                """).getBytes(StandardCharsets.UTF_8));
        return tree;
    }

    private static StampModel seedStamp() {
        StampModel stamp = new StampModel();
        stamp.setId("seed-1");
        stamp.setStampBytes("seed".getBytes(StandardCharsets.UTF_8));
        return stamp;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

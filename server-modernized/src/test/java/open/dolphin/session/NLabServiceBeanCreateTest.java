package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.Query;
import java.lang.reflect.Field;
import java.util.List;
import open.dolphin.infomodel.NLaboItem;
import open.dolphin.infomodel.NLaboModule;
import open.dolphin.infomodel.PatientModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class NLabServiceBeanCreateTest {

    private static final String PATIENT_QUERY = "from PatientModel p where p.facilityId=:fid and p.patientId=:pid";
    private static final String INSURANCE_QUERY = "from HealthInsuranceModel h where h.patient.id=:pk";
    private static final String MODULE_KEY_QUERY = "from NLaboModule m where m.moduleKey=:moduleKey";

    private NLabServiceBean service;
    private EntityManager em;

    @BeforeEach
    void setUp() throws Exception {
        service = new NLabServiceBean();
        em = mock(EntityManager.class);
        setField(service, "em", em);
    }

    @Test
    void create_remapsPatientAndItemsAndNormalizesModuleKey() {
        PatientModel patient = new PatientModel();
        patient.setId(10L);
        patient.setFacilityId("F001");
        patient.setPatientId("P001");

        Query patientQuery = queryReturningSingle(patient);
        Query insuranceQuery = queryReturningList(List.of());
        Query moduleQuery = queryThrowingNoResult();

        when(em.createQuery(PATIENT_QUERY)).thenReturn(patientQuery);
        when(em.createQuery(INSURANCE_QUERY)).thenReturn(insuranceQuery);
        when(em.createQuery(MODULE_KEY_QUERY)).thenReturn(moduleQuery);

        NLaboModule module = new NLaboModule();
        module.setPatientId("P001");
        module.setSampleDate("2024-01-01");
        module.setLaboCenterCode("WOLF");
        module.setModuleKey("P001.2024-01-01.WOLF");
        NLaboItem item = new NLaboItem();
        item.setPatientId("P001");
        module.setItems(List.of(item));

        PatientModel result = service.create("F001", module);

        assertThat(result).isSameAs(patient);
        assertThat(module.getPatientId()).isEqualTo("F001:P001");
        assertThat(module.getModuleKey()).isEqualTo("F001:P001.2024-01-01.WOLF");
        assertThat(module.getItems()).hasSize(1);
        assertThat(module.getItems().get(0).getPatientId()).isEqualTo("F001:P001");
    }

    private static Query queryReturningSingle(Object result) {
        Query query = mock(Query.class);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(result);
        return query;
    }

    private static Query queryReturningList(List<?> result) {
        Query query = mock(Query.class);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getResultList()).thenReturn(result);
        return query;
    }

    private static Query queryThrowingNoResult() {
        Query query = mock(Query.class);
        when(query.getSingleResult()).thenThrow(new NoResultException());
        return query;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

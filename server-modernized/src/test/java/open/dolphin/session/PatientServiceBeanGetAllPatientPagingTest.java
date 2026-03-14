package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.lang.reflect.Field;
import java.util.List;
import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.PatientModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PatientServiceBeanGetAllPatientPagingTest {

    private static final String QUERY_ALL_PATIENTS_BY_FACILITY =
            "from PatientModel p where p.facilityId=:fid order by p.patientId, p.id";
    private static final String QUERY_INSURANCE_BY_PATIENT_IDS =
            "from HealthInsuranceModel h where h.patient.id in (:ids)";

    private PatientServiceBean service;
    private EntityManager em;

    @BeforeEach
    void setUp() throws Exception {
        service = new PatientServiceBean();
        em = mock(EntityManager.class);
        setField(service, "em", em);
    }

    @Test
    void getAllPatientUsesDefaultPageSizeWhenPagingIsOmitted() {
        @SuppressWarnings("unchecked")
        TypedQuery<PatientModel> patientQuery = mock(TypedQuery.class);
        @SuppressWarnings("unchecked")
        TypedQuery<HealthInsuranceModel> insuranceQuery = mock(TypedQuery.class);

        PatientModel patient = new PatientModel();
        patient.setId(101L);
        patient.setFacilityId("F001");
        patient.setPatientId("P001");

        HealthInsuranceModel insurance = new HealthInsuranceModel();
        insurance.setPatient(patient);

        when(em.createQuery(QUERY_ALL_PATIENTS_BY_FACILITY, PatientModel.class)).thenReturn(patientQuery);
        when(patientQuery.setParameter("fid", "F001")).thenReturn(patientQuery);
        when(patientQuery.setFirstResult(0)).thenReturn(patientQuery);
        when(patientQuery.setMaxResults(PatientServiceBean.DEFAULT_ALL_PATIENT_PAGE_SIZE)).thenReturn(patientQuery);
        when(patientQuery.getResultList()).thenReturn(List.of(patient));

        when(em.createQuery(QUERY_INSURANCE_BY_PATIENT_IDS, HealthInsuranceModel.class)).thenReturn(insuranceQuery);
        when(insuranceQuery.setParameter("ids", List.of(101L))).thenReturn(insuranceQuery);
        when(insuranceQuery.getResultList()).thenReturn(List.of(insurance));

        List<PatientModel> actual = service.getAllPatient("F001");

        assertThat(actual).containsExactly(patient);
        assertThat(actual.get(0).getHealthInsurances()).containsExactly(insurance);
        verify(patientQuery).setFirstResult(0);
        verify(patientQuery).setMaxResults(PatientServiceBean.DEFAULT_ALL_PATIENT_PAGE_SIZE);
    }

    @Test
    void getAllPatientNormalizesOffsetAndLimit() {
        @SuppressWarnings("unchecked")
        TypedQuery<PatientModel> patientQuery = mock(TypedQuery.class);
        when(em.createQuery(QUERY_ALL_PATIENTS_BY_FACILITY, PatientModel.class)).thenReturn(patientQuery);
        when(patientQuery.setParameter("fid", "F001")).thenReturn(patientQuery);
        when(patientQuery.setFirstResult(0)).thenReturn(patientQuery);
        when(patientQuery.setMaxResults(PatientServiceBean.MAX_ALL_PATIENT_PAGE_SIZE)).thenReturn(patientQuery);
        when(patientQuery.getResultList()).thenReturn(List.of());

        List<PatientModel> actual = service.getAllPatient("F001", -25, 9999);

        assertThat(actual).isEmpty();
        verify(patientQuery).setFirstResult(0);
        verify(patientQuery).setMaxResults(PatientServiceBean.MAX_ALL_PATIENT_PAGE_SIZE);
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}

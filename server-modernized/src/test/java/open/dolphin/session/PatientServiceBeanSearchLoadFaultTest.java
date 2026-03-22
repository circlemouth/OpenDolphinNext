package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import java.lang.reflect.Field;
import java.util.List;
import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.PatientModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PatientServiceBeanSearchLoadFaultTest {

    private static final String QUERY_PATIENT_BY_FID_PID_EXACT =
            "from PatientModel p where p.facilityId=:fid and p.patientId=:pid";
    private static final String QUERY_PATIENT_BY_FID_PID_PREFIX =
            "from PatientModel p where p.facilityId=:fid and p.patientId like :pid";
    private static final String QUERY_INSURANCE_BY_PATIENT_PK =
            "from HealthInsuranceModel h where h.patient.id=:pk";

    private PatientServiceBean service;
    private EntityManager em;

    @BeforeEach
    void setUp() throws Exception {
        service = new PatientServiceBean();
        em = mock(EntityManager.class);
        setField(service, "em", em);
    }

    @Test
    void getPatientById_handlesBurstLoadWithExactLookupQuery() {
        Query patientQuery = mock(Query.class);
        Query insuranceQuery = mock(Query.class);

        PatientModel patient = new PatientModel();
        patient.setId(101L);
        patient.setFacilityId("F001");
        patient.setPatientId("P001");
        HealthInsuranceModel insurance = new HealthInsuranceModel();
        insurance.setPatient(patient);

        when(em.createQuery(QUERY_PATIENT_BY_FID_PID_EXACT)).thenReturn(patientQuery);
        when(patientQuery.setParameter("fid", "F001")).thenReturn(patientQuery);
        when(patientQuery.setParameter("pid", "P001")).thenReturn(patientQuery);
        when(patientQuery.getSingleResult()).thenReturn(patient);

        when(em.createQuery(QUERY_INSURANCE_BY_PATIENT_PK)).thenReturn(insuranceQuery);
        when(insuranceQuery.setParameter("pk", 101L)).thenReturn(insuranceQuery);
        when(insuranceQuery.getResultList()).thenReturn(List.of(insurance));

        long startedAt = System.nanoTime();
        for (int i = 0; i < 600; i++) {
            PatientModel actual = service.getPatientById("F001", "P001");
            assertThat(actual).isNotNull();
            assertThat(actual.getPatientId()).isEqualTo("P001");
        }
        long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000L;

        assertThat(elapsedMs).isLessThan(2000L);
        verify(em, times(600)).createQuery(QUERY_PATIENT_BY_FID_PID_EXACT);
        verify(em, never()).createQuery(QUERY_PATIENT_BY_FID_PID_PREFIX);
    }

    @Test
    void getPatientById_returnsNullOnNoResult() {
        Query patientQuery = mock(Query.class);
        when(em.createQuery(QUERY_PATIENT_BY_FID_PID_EXACT)).thenReturn(patientQuery);
        when(patientQuery.setParameter("fid", "F001")).thenReturn(patientQuery);
        when(patientQuery.setParameter("pid", "P404")).thenReturn(patientQuery);
        when(patientQuery.getSingleResult()).thenThrow(new NoResultException());

        PatientModel actual = service.getPatientById("F001", "P404");

        assertThat(actual).isNull();
        verify(em, never()).createQuery(QUERY_INSURANCE_BY_PATIENT_PK);
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

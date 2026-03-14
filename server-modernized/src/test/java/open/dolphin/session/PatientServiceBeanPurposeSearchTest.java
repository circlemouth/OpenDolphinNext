package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.lang.reflect.Field;
import java.util.List;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.session.PatientServiceBean.PatientSearchType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PatientServiceBeanPurposeSearchTest {

    private static final String QUERY_PATIENT_BY_NAME =
            "from PatientModel p where p.facilityId=:fid and p.fullName like :name";
    private static final String QUERY_PATIENT_BY_KANA =
            "from PatientModel p where p.facilityId=:fid and p.kanaName like :name";
    private static final String QUERY_PATIENT_BY_FID_PID_PREFIX =
            "from PatientModel p where p.facilityId=:fid and p.patientId like :pid";
    private static final String QUERY_PATIENT_BY_TELEPHONE =
            "from PatientModel p where p.facilityId = :fid and (p.telephone like :number or p.mobilePhone like :number)";
    private static final String QUERY_PATIENT_BY_ZIPCODE =
            "from PatientModel p where p.facilityId = :fid and p.address.zipCode like :zipCode";
    private static final String QUERY_PATIENT_BY_APPMEMO =
            "from PatientModel p where p.facilityId = :fid and p.appMemo like :appMemo";

    private PatientServiceBean service;
    private EntityManager em;

    @BeforeEach
    void setUp() throws Exception {
        service = new PatientServiceBean();
        em = mock(EntityManager.class);
        setField(service, "em", em);
    }

    @Test
    void searchPatients_nameUsesSingleNamePrefixQuery() {
        @SuppressWarnings("unchecked")
        TypedQuery<PatientModel> patientQuery = mock(TypedQuery.class);
        when(em.createQuery(QUERY_PATIENT_BY_NAME, PatientModel.class)).thenReturn(patientQuery);
        when(patientQuery.setParameter("fid", "F001")).thenReturn(patientQuery);
        when(patientQuery.setParameter("name", "山田%")).thenReturn(patientQuery);
        when(patientQuery.getResultList()).thenReturn(List.of(patient("P001")));

        List<PatientModel> actual = service.searchPatients("F001", PatientSearchType.NAME, "山田");

        assertThat(actual).hasSize(1);
        verify(em).createQuery(QUERY_PATIENT_BY_NAME, PatientModel.class);
        verify(em, never()).createQuery(QUERY_PATIENT_BY_APPMEMO, PatientModel.class);
        verify(em, never()).createQuery(QUERY_PATIENT_BY_KANA, PatientModel.class);
        verify(em, never()).createQuery(QUERY_PATIENT_BY_FID_PID_PREFIX, PatientModel.class);
    }

    @Test
    void searchPatients_patientIdDoesNotCascadeToTelephoneOrZipCode() {
        @SuppressWarnings("unchecked")
        TypedQuery<PatientModel> patientQuery = mock(TypedQuery.class);
        when(em.createQuery(QUERY_PATIENT_BY_FID_PID_PREFIX, PatientModel.class)).thenReturn(patientQuery);
        when(patientQuery.setParameter("fid", "F001")).thenReturn(patientQuery);
        when(patientQuery.setParameter("pid", "0001%")).thenReturn(patientQuery);
        when(patientQuery.getResultList()).thenReturn(List.of(patient("0001")));

        List<PatientModel> actual = service.searchPatients("F001", PatientSearchType.PATIENT_ID, "0001");

        assertThat(actual).hasSize(1);
        verify(em).createQuery(QUERY_PATIENT_BY_FID_PID_PREFIX, PatientModel.class);
        verify(em, never()).createQuery(QUERY_PATIENT_BY_TELEPHONE, PatientModel.class);
        verify(em, never()).createQuery(QUERY_PATIENT_BY_ZIPCODE, PatientModel.class);
    }

    @Test
    void searchPatients_allowsExplicitTelephoneSearch() {
        @SuppressWarnings("unchecked")
        TypedQuery<PatientModel> patientQuery = mock(TypedQuery.class);
        when(em.createQuery(QUERY_PATIENT_BY_TELEPHONE, PatientModel.class)).thenReturn(patientQuery);
        when(patientQuery.setParameter("fid", "F001")).thenReturn(patientQuery);
        when(patientQuery.setParameter("number", "090%")).thenReturn(patientQuery);
        when(patientQuery.getResultList()).thenReturn(List.of(patient("P090")));

        List<PatientModel> actual = service.searchPatients("F001", PatientSearchType.TELEPHONE, "090");

        assertThat(actual).hasSize(1);
        verify(em).createQuery(QUERY_PATIENT_BY_TELEPHONE, PatientModel.class);
        verify(em, never()).createQuery(QUERY_PATIENT_BY_FID_PID_PREFIX, PatientModel.class);
        verify(em, never()).createQuery(QUERY_PATIENT_BY_ZIPCODE, PatientModel.class);
    }

    private static PatientModel patient(String patientId) {
        PatientModel patient = new PatientModel();
        patient.setPatientId(patientId);
        return patient;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

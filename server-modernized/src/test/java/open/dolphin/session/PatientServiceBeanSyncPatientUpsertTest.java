package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import java.lang.reflect.Field;
import java.time.LocalDate;
import java.util.List;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class PatientServiceBeanSyncPatientUpsertTest {

    private static final String QUERY_PATIENT_IDS_BY_FACILITY_AND_IDS =
            "select p.patientId from PatientModel p where p.facilityId = :fid and p.patientId in (:ids)";
    private static final String QUERY_PATIENTS_BY_FACILITY_AND_IDS =
            "from PatientModel p where p.facilityId = :fid and p.patientId in (:ids)";
    private static final String QUERY_KARTE_BY_PATIENT_IDS =
            "from KarteBean k where k.patient.id in (:patientIds)";
    private static final String QUERY_SYNC_PATIENT_MAX_ID = "select coalesce(max(id), 0) from d_patient";
    private static final String QUERY_HIBERNATE_SEQUENCE_VALUE = "select last_value from opendolphin.hibernate_sequence";

    private PatientServiceBean service;
    private EntityManager em;
    private ChartEventServiceBean eventServiceBean;

    @BeforeEach
    void setUp() throws Exception {
        service = new PatientServiceBean();
        em = mock(EntityManager.class);
        eventServiceBean = mock(ChartEventServiceBean.class);
        setField(service, "em", em);
        setField(service, "eventServiceBean", eventServiceBean);
        when(eventServiceBean.getPvtList("F001")).thenReturn(List.of());
    }

    @Test
    void upsertPatientsForSync_usesSingleNativeUpsertAndOnlyCreatesMissingKarte() {
        @SuppressWarnings("unchecked")
        TypedQuery<String> existingIdsQuery = mock(TypedQuery.class);
        @SuppressWarnings("unchecked")
        TypedQuery<PatientModel> patientsQuery = mock(TypedQuery.class);
        @SuppressWarnings("unchecked")
        TypedQuery<KarteBean> karteQuery = mock(TypedQuery.class);
        Query maxIdQuery = mock(Query.class);
        Query sequenceQuery = mock(Query.class);
        Query nativeQuery = mock(Query.class);

        PatientModel incomingExisting = buildPatient("P001", "既存 患者");
        PatientModel incomingNew = buildPatient("P002", "新規 患者");

        PatientModel managedExisting = buildPatient("P001", "既存 患者");
        managedExisting.setId(101L);
        PatientModel managedNew = buildPatient("P002", "新規 患者");
        managedNew.setId(102L);

        KarteBean existingKarte = new KarteBean();
        existingKarte.setPatientModel(managedExisting);

        when(em.createQuery(QUERY_PATIENT_IDS_BY_FACILITY_AND_IDS, String.class)).thenReturn(existingIdsQuery);
        when(existingIdsQuery.setParameter("fid", "F001")).thenReturn(existingIdsQuery);
        when(existingIdsQuery.setParameter("ids", List.of("P001", "P002"))).thenReturn(existingIdsQuery);
        when(existingIdsQuery.getResultList()).thenReturn(List.of("P001"));

        when(em.createNativeQuery(QUERY_SYNC_PATIENT_MAX_ID)).thenReturn(maxIdQuery);
        when(maxIdQuery.getSingleResult()).thenReturn(102L);
        when(em.createNativeQuery(QUERY_HIBERNATE_SEQUENCE_VALUE)).thenReturn(sequenceQuery);
        when(sequenceQuery.getSingleResult()).thenReturn(200L);
        when(em.createNativeQuery(argThat(sql -> sql != null
                && sql.contains("insert into d_patient")
                && sql.contains("on conflict (facilityid, patientid) do update set")))).thenReturn(nativeQuery);
        when(nativeQuery.setParameter(anyInt(), any())).thenReturn(nativeQuery);
        when(nativeQuery.executeUpdate()).thenReturn(2);

        when(em.createQuery(QUERY_PATIENTS_BY_FACILITY_AND_IDS, PatientModel.class)).thenReturn(patientsQuery);
        when(patientsQuery.setParameter("fid", "F001")).thenReturn(patientsQuery);
        when(patientsQuery.setParameter("ids", List.of("P001", "P002"))).thenReturn(patientsQuery);
        when(patientsQuery.getResultList()).thenReturn(List.of(managedExisting, managedNew));

        when(em.createQuery(QUERY_KARTE_BY_PATIENT_IDS, KarteBean.class)).thenReturn(karteQuery);
        when(karteQuery.setParameter("patientIds", List.of(101L, 102L))).thenReturn(karteQuery);
        when(karteQuery.getResultList()).thenReturn(List.of(existingKarte));

        PatientServiceBean.SyncPatientUpsertResult result =
                service.upsertPatientsForSync("F001", List.of(incomingExisting, incomingNew));

        assertThat(result.createdCount()).isEqualTo(1);
        assertThat(result.updatedCount()).isEqualTo(1);
        verify(nativeQuery).executeUpdate();
        verify(em, never()).flush();

        ArgumentCaptor<KarteBean> karteCaptor = ArgumentCaptor.forClass(KarteBean.class);
        verify(em).persist(karteCaptor.capture());
        assertThat(karteCaptor.getValue().getPatientModel()).isSameAs(managedNew);
    }

    @Test
    void upsertPatientsForSync_alignsHibernateSequenceWhenPatientTableIsAhead() {
        @SuppressWarnings("unchecked")
        TypedQuery<String> existingIdsQuery = mock(TypedQuery.class);
        @SuppressWarnings("unchecked")
        TypedQuery<PatientModel> patientsQuery = mock(TypedQuery.class);
        @SuppressWarnings("unchecked")
        TypedQuery<KarteBean> karteQuery = mock(TypedQuery.class);
        Query maxIdQuery = mock(Query.class);
        Query sequenceQuery = mock(Query.class);
        Query setSequenceQuery = mock(Query.class);
        Query nativeQuery = mock(Query.class);

        PatientModel incoming = buildPatient("P002", "新規 患者");
        PatientModel managed = buildPatient("P002", "新規 患者");
        managed.setId(102L);

        when(em.createQuery(QUERY_PATIENT_IDS_BY_FACILITY_AND_IDS, String.class)).thenReturn(existingIdsQuery);
        when(existingIdsQuery.setParameter("fid", "F001")).thenReturn(existingIdsQuery);
        when(existingIdsQuery.setParameter("ids", List.of("P002"))).thenReturn(existingIdsQuery);
        when(existingIdsQuery.getResultList()).thenReturn(List.of());

        when(em.createNativeQuery(QUERY_SYNC_PATIENT_MAX_ID)).thenReturn(maxIdQuery);
        when(maxIdQuery.getSingleResult()).thenReturn(102L);
        when(em.createNativeQuery(QUERY_HIBERNATE_SEQUENCE_VALUE)).thenReturn(sequenceQuery);
        when(sequenceQuery.getSingleResult()).thenReturn(90L);
        when(em.createNativeQuery(argThat(sql -> sql != null
                && sql.contains("select setval('opendolphin.hibernate_sequence'"))))
                .thenReturn(setSequenceQuery);
        when(setSequenceQuery.setParameter("nextValue", 102L)).thenReturn(setSequenceQuery);
        when(setSequenceQuery.getSingleResult()).thenReturn(102L);

        when(em.createNativeQuery(argThat(sql -> sql != null
                && sql.contains("insert into d_patient")
                && sql.contains("on conflict (facilityid, patientid) do update set")))).thenReturn(nativeQuery);
        when(nativeQuery.setParameter(anyInt(), any())).thenReturn(nativeQuery);
        when(nativeQuery.executeUpdate()).thenReturn(1);

        when(em.createQuery(QUERY_PATIENTS_BY_FACILITY_AND_IDS, PatientModel.class)).thenReturn(patientsQuery);
        when(patientsQuery.setParameter("fid", "F001")).thenReturn(patientsQuery);
        when(patientsQuery.setParameter("ids", List.of("P002"))).thenReturn(patientsQuery);
        when(patientsQuery.getResultList()).thenReturn(List.of(managed));

        when(em.createQuery(QUERY_KARTE_BY_PATIENT_IDS, KarteBean.class)).thenReturn(karteQuery);
        when(karteQuery.setParameter("patientIds", List.of(102L))).thenReturn(karteQuery);
        when(karteQuery.getResultList()).thenReturn(List.of());

        PatientServiceBean.SyncPatientUpsertResult result = service.upsertPatientsForSync("F001", List.of(incoming));

        assertThat(result.createdCount()).isEqualTo(1);
        assertThat(result.updatedCount()).isEqualTo(0);
        verify(setSequenceQuery).setParameter("nextValue", 102L);
        verify(nativeQuery).executeUpdate();
    }

    private static PatientModel buildPatient(String patientId, String fullName) {
        PatientModel patient = new PatientModel();
        patient.setFacilityId("F001");
        patient.setPatientId(patientId);
        patient.setFullName(fullName);
        patient.setFamilyName(fullName.split(" ")[0]);
        patient.setGivenName(fullName.split(" ")[1]);
        patient.setKanaName("カナ");
        patient.setGender("M");
        patient.setBirthday(LocalDate.of(1980, 1, 1));
        patient.setTelephone("0311112222");
        patient.setMobilePhone("09011112222");
        SimpleAddressModel address = new SimpleAddressModel();
        address.setZipCode("100-0001");
        address.setAddress("東京都");
        patient.setAddress(address);
        return patient;
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}

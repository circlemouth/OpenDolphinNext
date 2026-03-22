package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import java.lang.reflect.Field;
import java.util.List;
import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class PatientServiceBeanAddPatientTest {

    private PatientServiceBean service;
    private EntityManager em;
    private TypedQuery<KarteBean> karteQuery;
    private ChartEventServiceBean eventServiceBean;

    @BeforeEach
    void setUp() throws Exception {
        service = new PatientServiceBean();
        em = mock(EntityManager.class);
        karteQuery = mock(TypedQuery.class);
        eventServiceBean = mock(ChartEventServiceBean.class);
        setField(service, "em", em);
        setField(service, "eventServiceBean", eventServiceBean);
        when(eventServiceBean.getPvtList("F001")).thenReturn(List.of());
    }

    @Test
    void addPatient_usesPersistAndFlush_withoutManualSequence() {
        PatientModel patient = new PatientModel();
        patient.setFacilityId("F001");
        patient.setPatientId("P001");
        patient.setFullName("Test Patient");
        patient.setGender("M");

        doAnswer(invocation -> {
            PatientModel persisted = invocation.getArgument(0);
            persisted.setId(101L);
            return null;
        }).when(em).persist(patient);
        when(em.createQuery("from KarteBean k where k.patient.id = :patientPk", KarteBean.class))
                .thenReturn(karteQuery);
        when(karteQuery.setParameter("patientPk", 101L)).thenReturn(karteQuery);
        when(karteQuery.setMaxResults(1)).thenReturn(karteQuery);
        when(karteQuery.getResultList()).thenReturn(java.util.List.of());

        long id = service.addPatient(patient);

        assertThat(id).isEqualTo(101L);
        InOrder order = inOrder(em);
        order.verify(em).persist(patient);
        order.verify(em).flush();
        order.verify(em).persist(org.mockito.ArgumentMatchers.any(KarteBean.class));
        order.verify(em).flush();
        verify(em, never()).createNativeQuery(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void updateForFacility_updatesPatientWithinSameFacility() {
        PatientModel existing = new PatientModel();
        existing.setId(101L);
        existing.setFacilityId("F001");
        existing.setPatientId("P001");

        PatientModel update = new PatientModel();
        update.setId(101L);
        update.setFacilityId("WRONG");
        update.setPatientId("P001");
        update.setFullName("Updated Name");

        KarteBean existingKarte = new KarteBean();
        existingKarte.setPatientModel(existing);

        when(em.find(PatientModel.class, 101L)).thenReturn(existing);
        when(em.merge(update)).thenReturn(update);
        when(em.createQuery("from KarteBean k where k.patient.id = :patientPk", KarteBean.class))
                .thenReturn(karteQuery);
        when(karteQuery.setParameter("patientPk", 101L)).thenReturn(karteQuery);
        when(karteQuery.setMaxResults(1)).thenReturn(karteQuery);
        when(karteQuery.getResultList()).thenReturn(List.of(existingKarte));

        int updated = service.updateForFacility("F001", update);

        assertThat(updated).isEqualTo(1);
        assertThat(update.getFacilityId()).isEqualTo("F001");
        verify(em).merge(update);
        verify(em, never()).persist(org.mockito.ArgumentMatchers.any(KarteBean.class));
    }

    @Test
    void updateForFacility_rejectsWhenFacilityDoesNotMatch() {
        PatientModel existing = new PatientModel();
        existing.setId(101L);
        existing.setFacilityId("F999");
        existing.setPatientId("P001");

        PatientModel update = new PatientModel();
        update.setId(101L);
        update.setFacilityId("F001");
        update.setPatientId("P001");

        when(em.find(PatientModel.class, 101L)).thenReturn(existing);

        int updated = service.updateForFacility("F001", update);

        assertThat(updated).isEqualTo(0);
        verify(em, never()).merge(org.mockito.ArgumentMatchers.any(PatientModel.class));
    }

    @Test
    void getPatientById_populatesHealthInsurancesAndKeepsOrder() {
        @SuppressWarnings("unchecked")
        TypedQuery<PatientModel> patientQuery = mock(TypedQuery.class);
        Query insuranceQuery = mock(Query.class);
        PatientModel patient = new PatientModel();
        patient.setId(101L);
        patient.setFacilityId("F001");
        patient.setPatientId("P001");

        HealthInsuranceModel primary = new HealthInsuranceModel();
        primary.setBeanJson("{\"kind\":\"PRIMARY\"}");
        primary.setPatient(patient);
        HealthInsuranceModel secondary = new HealthInsuranceModel();
        secondary.setBeanJson("{\"kind\":\"SECONDARY\"}");
        secondary.setPatient(patient);

        when(em.createQuery("from PatientModel p where p.facilityId=:fid and p.patientId=:pid"))
                .thenReturn(patientQuery);
        when(patientQuery.setParameter("fid", "F001")).thenReturn(patientQuery);
        when(patientQuery.setParameter("pid", "P001")).thenReturn(patientQuery);
        when(patientQuery.getSingleResult()).thenReturn(patient);

        when(em.createQuery("from HealthInsuranceModel h where h.patient.id=:pk"))
                .thenReturn(insuranceQuery);
        when(insuranceQuery.setParameter("pk", 101L)).thenReturn(insuranceQuery);
        when(insuranceQuery.getResultList()).thenReturn(List.of(primary, secondary));

        PatientModel found = service.getPatientById("F001", "P001");

        assertThat(found).isNotNull();
        assertThat(found.getHealthInsurances()).containsExactly(primary, secondary);
        verify(em, times(1)).createQuery("from HealthInsuranceModel h where h.patient.id=:pk");
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }
}

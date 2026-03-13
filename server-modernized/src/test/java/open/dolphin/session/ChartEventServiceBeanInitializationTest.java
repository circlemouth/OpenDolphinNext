package open.dolphin.session;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.lang.reflect.Field;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import open.dolphin.infomodel.AppointmentModel;
import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.mbean.ServletContextHolder;
import open.dolphin.session.support.ChartEventStreamPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class ChartEventServiceBeanInitializationTest {

    private static final String QUERY_PVT_BY_DATE =
            "from PatientVisitModel p where p.pvtDate >= :fromDate and p.pvtDate < :toDate order by p.id";
    private static final String QUERY_INSURANCE_BY_PATIENT_IDS =
            "from HealthInsuranceModel h where h.patient.id in :patientIds";
    private static final String QUERY_KARTE_BY_PATIENT_IDS =
            "from KarteBean k where k.patient.id in :patientIds";
    private static final String QUERY_APPOINTMENTS_BY_KARTE_IDS_DATE =
            "from AppointmentModel a where a.karte.id in :karteIds and a.date = :date";
    private static final String QUERY_DIAGNOSES_BY_KARTE_IDS =
            "from RegisteredDiagnosisModel r where r.karte.id in :karteIds";

    private ChartEventServiceBean service;
    private ServletContextHolder contextHolder;
    private EntityManager em;
    private Query pvtQuery;
    private Query insuranceQuery;
    private Query karteQuery;
    private Query appointmentQuery;
    private Query diagnosisQuery;

    @BeforeEach
    void setUp() throws Exception {
        service = new ChartEventServiceBean();
        contextHolder = new ServletContextHolder();
        contextHolder.setToday();
        em = mock(EntityManager.class);
        pvtQuery = mock(Query.class);
        insuranceQuery = mock(Query.class);
        karteQuery = mock(Query.class);
        appointmentQuery = mock(Query.class);
        diagnosisQuery = mock(Query.class);

        when(em.createQuery(QUERY_PVT_BY_DATE)).thenReturn(pvtQuery);
        when(em.createQuery(QUERY_INSURANCE_BY_PATIENT_IDS)).thenReturn(insuranceQuery);
        when(em.createQuery(QUERY_KARTE_BY_PATIENT_IDS)).thenReturn(karteQuery);
        when(em.createQuery(QUERY_APPOINTMENTS_BY_KARTE_IDS_DATE)).thenReturn(appointmentQuery);
        when(em.createQuery(QUERY_DIAGNOSES_BY_KARTE_IDS)).thenReturn(diagnosisQuery);

        when(pvtQuery.setParameter(eq("fromDate"), any())).thenReturn(pvtQuery);
        when(pvtQuery.setParameter(eq("toDate"), any())).thenReturn(pvtQuery);
        when(pvtQuery.getResultList()).thenReturn(List.of());

        when(insuranceQuery.setParameter(eq("patientIds"), any())).thenReturn(insuranceQuery);
        when(insuranceQuery.getResultList()).thenReturn(List.of());

        when(karteQuery.setParameter(eq("patientIds"), any())).thenReturn(karteQuery);
        when(karteQuery.getResultList()).thenReturn(List.of());

        when(appointmentQuery.setParameter(eq("karteIds"), any())).thenReturn(appointmentQuery);
        when(appointmentQuery.setParameter(eq("date"), any())).thenReturn(appointmentQuery);
        when(appointmentQuery.getResultList()).thenReturn(List.of());

        when(diagnosisQuery.setParameter(eq("karteIds"), any())).thenReturn(diagnosisQuery);
        when(diagnosisQuery.getResultList()).thenReturn(List.of());

        setField(service, "contextHolder", contextHolder);
        setField(service, "chartEventStreamPublisher", mock(ChartEventStreamPublisher.class));
        setField(service, "em", em);
    }

    @Test
    void ensureInitializedBindsPatientVisitWindowAsLocalDateTime() throws Exception {
        service.ensureInitialized();

        LocalDateTime expectedFromDate = LocalDate.ofInstant(
                contextHolder.getToday().toInstant(), ZoneId.systemDefault()).atStartOfDay();
        LocalDateTime expectedToDate = LocalDate.ofInstant(
                contextHolder.getTomorrow().toInstant(), ZoneId.systemDefault()).atStartOfDay();

        verify(pvtQuery).setParameter("fromDate", expectedFromDate);
        verify(pvtQuery).setParameter("toDate", expectedToDate);
    }

    @Test
    void ensureInitialized_batchesRelatedLookupsAcrossVisits() throws Exception {
        PatientModel patient1 = patient(11L, "p1");
        PatientModel patient2 = patient(22L, "p2");
        PatientVisitModel pvt1 = visit(101L, patient1, LocalDateTime.of(2026, 3, 14, 0, 0));
        PatientVisitModel pvt2 = visit(102L, patient2, LocalDateTime.of(2026, 3, 14, 9, 30));
        when(pvtQuery.getResultList()).thenReturn(List.of(pvt1, pvt2));

        HealthInsuranceModel insurance1 = insurance(patient1);
        HealthInsuranceModel insurance2 = insurance(patient2);
        when(insuranceQuery.getResultList()).thenReturn(List.of(insurance1, insurance2));

        KarteBean karte1 = karte(201L, patient1);
        KarteBean karte2 = karte(202L, patient2);
        when(karteQuery.getResultList()).thenReturn(List.of(karte1, karte2));

        AppointmentModel appointment = appointment(karte1, "予約A");
        when(appointmentQuery.getResultList()).thenReturn(List.of(appointment));

        RegisteredDiagnosisModel diagnosisToday = diagnosis(karte1, pvt1.getPvtDate(), null);
        RegisteredDiagnosisModel diagnosisActive = diagnosis(
                karte2,
                LocalDateTime.of(2026, 3, 10, 10, 0),
                LocalDateTime.of(2026, 3, 20, 0, 0));
        when(diagnosisQuery.getResultList()).thenReturn(List.of(diagnosisToday, diagnosisActive));

        service.ensureInitialized();

        verify(em).createQuery(QUERY_INSURANCE_BY_PATIENT_IDS);
        verify(em).createQuery(QUERY_KARTE_BY_PATIENT_IDS);
        verify(em).createQuery(QUERY_APPOINTMENTS_BY_KARTE_IDS_DATE);
        verify(em).createQuery(QUERY_DIAGNOSES_BY_KARTE_IDS);

        InOrder inOrder = inOrder(em);
        inOrder.verify(em).createQuery(QUERY_PVT_BY_DATE);
        inOrder.verify(em).createQuery(QUERY_INSURANCE_BY_PATIENT_IDS);
        inOrder.verify(em).createQuery(QUERY_KARTE_BY_PATIENT_IDS);
        inOrder.verify(em).createQuery(QUERY_APPOINTMENTS_BY_KARTE_IDS_DATE);
        inOrder.verify(em).createQuery(QUERY_DIAGNOSES_BY_KARTE_IDS);

        verify(insuranceQuery).setParameter(eq("patientIds"), any());
        verify(karteQuery).setParameter(eq("patientIds"), any());
        verify(appointmentQuery).setParameter(eq("karteIds"), any());
        verify(diagnosisQuery).setParameter(eq("karteIds"), any());

        org.junit.jupiter.api.Assertions.assertEquals("予約A", pvt1.getAppointment());
        org.junit.jupiter.api.Assertions.assertEquals(1, pvt1.getByomeiCount());
        org.junit.jupiter.api.Assertions.assertEquals(1, pvt1.getByomeiCountToday());
        org.junit.jupiter.api.Assertions.assertEquals(1, pvt2.getByomeiCount());
        org.junit.jupiter.api.Assertions.assertEquals(0, pvt2.getByomeiCountToday());
        org.junit.jupiter.api.Assertions.assertEquals(1, patient1.getHealthInsurances().size());
        org.junit.jupiter.api.Assertions.assertEquals(1, patient2.getHealthInsurances().size());
    }

    private static PatientModel patient(long id, String patientId) {
        PatientModel model = new PatientModel();
        model.setId(id);
        model.setPatientId(patientId);
        model.setFacilityId("facility-1");
        model.setFullName("patient-" + patientId);
        model.setGender("M");
        return model;
    }

    private static PatientVisitModel visit(long id, PatientModel patient, LocalDateTime pvtDate) {
        PatientVisitModel model = new PatientVisitModel();
        model.setId(id);
        model.setFacilityId("facility-1");
        model.setPatientModel(patient);
        model.setPvtDate(pvtDate);
        return model;
    }

    private static HealthInsuranceModel insurance(PatientModel patient) {
        HealthInsuranceModel insurance = new HealthInsuranceModel();
        insurance.setPatient(patient);
        insurance.setBeanJson("{}");
        return insurance;
    }

    private static KarteBean karte(long id, PatientModel patient) {
        KarteBean karte = new KarteBean();
        karte.setId(id);
        karte.setPatientModel(patient);
        return karte;
    }

    private static AppointmentModel appointment(KarteBean karte, String name) {
        AppointmentModel appointment = new AppointmentModel();
        appointment.setKarteBean(karte);
        appointment.setName(name);
        return appointment;
    }

    private static RegisteredDiagnosisModel diagnosis(KarteBean karte, LocalDateTime started, LocalDateTime ended) {
        RegisteredDiagnosisModel diagnosis = new RegisteredDiagnosisModel();
        diagnosis.setKarteBean(karte);
        diagnosis.setStarted(Date.from(started.atZone(ZoneId.systemDefault()).toInstant()));
        if (ended != null) {
            diagnosis.setEnded(Date.from(ended.atZone(ZoneId.systemDefault()).toInstant()));
        }
        return diagnosis;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

package open.dolphin.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.Query;
import java.lang.reflect.Field;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;
import open.dolphin.infomodel.AppointmentModel;
import open.dolphin.infomodel.ChartEventModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.mbean.ServletContextHolder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class PVTServiceBeanAddPvtTest {

    private static final String QUERY_PATIENT_BY_FID_PID =
            "from PatientModel p where p.facilityId=:fid and p.patientId=:pid";
    private static final String QUERY_INSURANCE_BY_PATIENT_ID =
            "from HealthInsuranceModel h where h.patient.id=:id";
    private static final String QUERY_KARTE_ID_BY_PATIENT_ID =
            "select k.id from KarteBean k where k.patient.id = :id";
    private static final String QUERY_APPO_BY_KARTE_ID_DATE =
            "from AppointmentModel a where a.karte.id=:id and a.date=:date";

    private PVTServiceBean service;
    private EntityManager em;
    private ChartEventServiceBean eventServiceBean;
    private ServletContextHolder contextHolder;

    @BeforeEach
    void setUp() throws Exception {
        service = new PVTServiceBean();
        em = org.mockito.Mockito.mock(EntityManager.class);
        eventServiceBean = org.mockito.Mockito.mock(ChartEventServiceBean.class);
        contextHolder = new ServletContextHolder();
        contextHolder.setToday();
        contextHolder.setServerUUID("server-1");

        setField(service, "em", em);
        setField(service, "eventServiceBean", eventServiceBean);
        setField(service, "contextHolder", contextHolder);

        when(em.merge(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void addPvt_persistsNewTodayVisitAndAddsNotification() {
        PatientModel existingPatient = patient(101L, "F001", "P001", "owner-existing");
        PatientVisitModel incoming = visit(existingPatient.getPatientId(), todayAt(9, 0));

        Query patientQuery = queryReturningSingle(existingPatient);
        Query insuranceQuery = queryReturningList(List.of());
        Query karteIdQuery = queryReturningSingle(501L);
        AppointmentModel appointment = new AppointmentModel();
        appointment.setName("09:00 予約");
        Query appointmentQuery = queryReturningList(List.of(appointment));
        when(em.createQuery(QUERY_PATIENT_BY_FID_PID)).thenReturn(patientQuery);
        when(em.createQuery(QUERY_INSURANCE_BY_PATIENT_ID)).thenReturn(insuranceQuery);
        when(em.createQuery(QUERY_KARTE_ID_BY_PATIENT_ID)).thenReturn(karteIdQuery);
        when(em.createQuery(QUERY_APPO_BY_KARTE_ID_DATE)).thenReturn(appointmentQuery);

        int added = service.addPvt(incoming);

        assertEquals(1, added);
        assertSame(existingPatient, incoming.getPatientModel());
        assertEquals("09:00 予約", incoming.getAppointment());
        verify(eventServiceBean).setByomeiCount(501L, incoming);
        verify(em).persist(incoming);

        ArgumentCaptor<ChartEventModel> eventCaptor = ArgumentCaptor.forClass(ChartEventModel.class);
        verify(eventServiceBean).notifyEvent(eventCaptor.capture());
        assertEquals(ChartEventModel.PVT_ADD, eventCaptor.getValue().getEventType());
        assertSame(incoming, eventCaptor.getValue().getPatientVisitModel());
    }

    @Test
    void addPvt_persistsTodayVisitEvenWhenSamePatientAndTimestampAlreadyExist() {
        PatientModel existingPatient = patient(101L, "F001", "P001", "owner-existing");
        PatientVisitModel existingVisit = visit(existingPatient.getPatientId(), todayAt(9, 0));
        existingVisit.setId(900L);
        existingVisit.setFacilityId("F001");
        existingVisit.setPatientModel(existingPatient);
        existingVisit.setState(3);

        PatientVisitModel incoming = visit(existingPatient.getPatientId(), todayAt(9, 0));

        Query patientQuery = queryReturningSingle(existingPatient);
        Query insuranceQuery = queryReturningList(List.of());
        Query karteIdQuery = queryReturningSingle(501L);
        Query appointmentQuery = queryReturningList(List.of());

        when(em.createQuery(QUERY_PATIENT_BY_FID_PID)).thenReturn(patientQuery);
        when(em.createQuery(QUERY_INSURANCE_BY_PATIENT_ID)).thenReturn(insuranceQuery);
        when(em.createQuery(QUERY_KARTE_ID_BY_PATIENT_ID)).thenReturn(karteIdQuery);
        when(em.createQuery(QUERY_APPO_BY_KARTE_ID_DATE)).thenReturn(appointmentQuery);

        int added = service.addPvt(incoming);

        assertEquals(1, added);
        assertEquals(0L, incoming.getId());
        assertEquals(0, incoming.getState());
        verify(em).persist(incoming);
        verify(em, never()).merge(incoming);
        verify(eventServiceBean).setByomeiCount(501L, incoming);

        ArgumentCaptor<ChartEventModel> eventCaptor = ArgumentCaptor.forClass(ChartEventModel.class);
        verify(eventServiceBean).notifyEvent(eventCaptor.capture());
        assertEquals(ChartEventModel.PVT_ADD, eventCaptor.getValue().getEventType());
        assertSame(incoming, eventCaptor.getValue().getPatientVisitModel());
        assertNull(incoming.getAppointment());
    }

    @Test
    void addPvt_addsNewPatientOnlyWhenPvtDateIsMissing() {
        PatientVisitModel incoming = visit("P002", null);
        incoming.getPatientModel().setFullName("New Patient");
        incoming.getPatientModel().setGender("F");

        Query patientQuery = queryThrowingNoResult();
        when(em.createQuery(QUERY_PATIENT_BY_FID_PID)).thenReturn(patientQuery);

        int added = service.addPvt(incoming);

        assertEquals(0, added);
        verify(em).persist(incoming.getPatientModel());
        verify(em, never()).persist(incoming);
        verify(eventServiceBean, never()).notifyEvent(any(ChartEventModel.class));
    }

    @Test
    void addPvt_persistsScheduledVisitWithoutMergingByPatientAndDay() {
        PatientModel existingPatient = patient(101L, "F001", "P001", "owner-existing");
        PatientVisitModel existingVisit = visit(existingPatient.getPatientId(), LocalDate.now().plusDays(1).atTime(9, 0));
        existingVisit.setFacilityId("F001");
        existingVisit.setPatientModel(existingPatient);
        existingVisit.setDoctorName("旧医師");

        PatientVisitModel incoming = visit(existingPatient.getPatientId(), LocalDate.now().plusDays(1).atTime(9, 0));
        incoming.setDoctorName("新医師");

        Query patientQuery = queryReturningSingle(existingPatient);
        Query insuranceQuery = queryReturningList(List.of());

        when(em.createQuery(QUERY_PATIENT_BY_FID_PID)).thenReturn(patientQuery);
        when(em.createQuery(QUERY_INSURANCE_BY_PATIENT_ID)).thenReturn(insuranceQuery);

        int added = service.addPvt(incoming);

        assertEquals(1, added);
        assertEquals("旧医師", existingVisit.getDoctorName());
        verify(em).persist(incoming);
        verify(eventServiceBean, never()).setByomeiCount(any(Long.class), any(PatientVisitModel.class));
        verify(eventServiceBean, never()).notifyEvent(any(ChartEventModel.class));
    }

    private Query queryReturningSingle(Object result) {
        Query query = org.mockito.Mockito.mock(Query.class);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(result);
        return query;
    }

    private Query queryReturningList(List<?> result) {
        Query query = org.mockito.Mockito.mock(Query.class);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getResultList()).thenReturn(result);
        return query;
    }

    private Query queryThrowingNoResult() {
        Query query = org.mockito.Mockito.mock(Query.class);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getSingleResult()).thenThrow(new NoResultException());
        return query;
    }

    private static PatientVisitModel visit(String patientId, LocalDateTime pvtDate) {
        PatientVisitModel model = new PatientVisitModel();
        model.setFacilityId("F001");
        model.setPvtDate(pvtDate);
        model.setDeptName("内科");
        model.setDeptCode("01");
        model.setDoctorName("医師");
        model.setDoctorId("D001");
        model.setJmariNumber("JMARI");
        model.setPatientModel(patient(0L, "F001", patientId, null));
        return model;
    }

    private static PatientModel patient(long id, String facilityId, String patientId, String ownerUuid) {
        PatientModel patient = new PatientModel();
        patient.setId(id);
        patient.setFacilityId(facilityId);
        patient.setPatientId(patientId);
        patient.setFullName("Test Patient");
        patient.setGender("M");
        patient.setOwnerUUID(ownerUuid);
        return patient;
    }

    private static LocalDateTime todayAt(int hour, int minute) {
        return LocalDate.now().atTime(hour, minute);
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

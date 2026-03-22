package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.List;
import open.dolphin.infomodel.ChartEventModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.mbean.ServletContextHolder;
import open.dolphin.session.support.ChartEventStreamPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ChartEventServiceBeanPvtStateEventTest {

    private ChartEventServiceBean service;
    private EntityManager em;
    private ServletContextHolder contextHolder;
    private ChartEventStreamPublisher publisher;

    @BeforeEach
    void setUp() throws Exception {
        service = new ChartEventServiceBean();
        em = mock(EntityManager.class);
        contextHolder = new ServletContextHolder();
        contextHolder.setServerUUID("server-1");
        contextHolder.setToday();
        publisher = mock(ChartEventStreamPublisher.class);
        setField(service, "em", em);
        setField(service, "contextHolder", contextHolder);
        setField(service, "chartEventStreamPublisher", publisher);
    }

    @Test
    void processChartEvent_normalizesLegacyStateAndUpdatesCachedVisits() {
        PatientModel patient = patient(200L);
        PatientVisitModel persisted = visit(10L, patient, "F001", 1 << PatientVisitModel.BIT_CANCEL);
        PatientVisitModel cached = visit(10L, patient, "F001", 1 << PatientVisitModel.BIT_CANCEL);
        PatientVisitModel samePatient = visit(11L, patient, "F001", 0);
        contextHolder.addPvt("F001", cached);
        contextHolder.addPvt("F001", samePatient);
        when(em.find(PatientVisitModel.class, 10L)).thenReturn(persisted);

        ChartEventModel evt = new ChartEventModel("issuer-1");
        evt.setEventType(ChartEventModel.PVT_STATE);
        evt.setFacilityId("F001");
        evt.setPvtPk(10L);
        evt.setState(1);
        evt.setByomeiCount(3);
        evt.setByomeiCountToday(1);
        evt.setMemo("memo");
        evt.setOwnerUUID("owner-1");

        int result = service.processChartEvent(evt);

        assertThat(result).isEqualTo(1);
        assertThat(evt.getState()).isZero();
        assertThat(persisted.getState()).isZero();
        assertThat(persisted.getByomeiCount()).isEqualTo(3);
        assertThat(persisted.getByomeiCountToday()).isEqualTo(1);
        assertThat(persisted.getMemo()).isEqualTo("memo");
        assertThat(persisted.getPatientModel().getOwnerUUID()).isEqualTo("owner-1");
        assertThat(cached.getPatientModel().getOwnerUUID()).isEqualTo("owner-1");
        assertThat(samePatient.getStateBit(PatientVisitModel.BIT_OPEN)).isTrue();
        assertThat(samePatient.getPatientModel().getOwnerUUID()).isEqualTo("owner-1");
        verify(publisher).broadcast(evt);
    }

    @Test
    void processChartEvent_rejectsWhenFacilityDoesNotMatch() {
        PatientModel patient = patient(200L);
        PatientVisitModel persisted = visit(10L, patient, "F999", 0);
        contextHolder.addPvt("F001", visit(10L, patient, "F001", 0));
        when(em.find(PatientVisitModel.class, 10L)).thenReturn(persisted);

        ChartEventModel evt = new ChartEventModel("issuer-1");
        evt.setEventType(ChartEventModel.PVT_STATE);
        evt.setFacilityId("F001");
        evt.setPvtPk(10L);
        evt.setState(1);
        evt.setOwnerUUID("owner-1");

        int result = service.processChartEvent(evt);

        assertThat(result).isEqualTo(1);
        assertThat(persisted.getState()).isZero();
        verify(publisher, never()).broadcast(evt);
    }

    private static PatientModel patient(long id) {
        PatientModel model = new PatientModel();
        model.setId(id);
        model.setFacilityId("F001");
        model.setPatientId("P001");
        return model;
    }

    private static PatientVisitModel visit(long id, PatientModel patient, String fid, int state) {
        PatientVisitModel model = new PatientVisitModel();
        model.setId(id);
        model.setFacilityId(fid);
        model.setPatientModel(patient);
        model.setPvtDate(LocalDateTime.of(2026, 3, 22, 9, 0));
        model.setState(state);
        return model;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}

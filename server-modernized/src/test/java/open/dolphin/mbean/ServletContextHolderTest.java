package open.dolphin.mbean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDateTime;
import java.util.List;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ServletContextHolderTest {

    private ServletContextHolder holder;

    @BeforeEach
    void setUp() {
        holder = new ServletContextHolder();
    }

    @Test
    void getPvtListReturnsSnapshotAndDoesNotExposeStructuralMutation() {
        holder.addPvt("F001", visit(1L, "P001"));

        List<PatientVisitModel> snapshot = holder.getPvtList("F001");
        snapshot.clear();

        assertEquals(1, holder.getPvtList("F001").size());
    }

    @Test
    void replaceOrAddAndRemoveOperateOnInternalList() {
        holder.addPvt("F001", visit(1L, "P001"));
        holder.replaceOrAddPvt("F001", visit(1L, "P001-replaced"));
        holder.replaceOrAddPvt("F001", visit(2L, "P002"));

        List<PatientVisitModel> snapshot = holder.getPvtList("F001");
        assertEquals(2, snapshot.size());
        assertEquals("P001-replaced", snapshot.get(0).getPatientModel().getPatientId());

        assertTrue(holder.removePvtById("F001", 1L));
        assertFalse(holder.removePvtById("F001", 99L));
        assertEquals(List.of("P002"), holder.getPvtList("F001").stream()
                .map(model -> model.getPatientModel().getPatientId())
                .toList());
    }

    private static PatientVisitModel visit(long id, String patientId) {
        PatientVisitModel visit = new PatientVisitModel();
        visit.setId(id);
        visit.setFacilityId("F001");
        visit.setPvtDate(LocalDateTime.of(2026, 3, 15, 9, 0));
        visit.setPatientModel(patient(patientId));
        return visit;
    }

    private static PatientModel patient(String patientId) {
        PatientModel patient = new PatientModel();
        patient.setPatientId(patientId);
        patient.setFacilityId("F001");
        return patient;
    }
}

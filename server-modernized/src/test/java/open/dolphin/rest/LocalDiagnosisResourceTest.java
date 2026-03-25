package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.time.LocalDate;
import java.util.Date;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LocalDiagnosisResourceTest {

    private LocalDiagnosisResource resource;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() throws Exception {
        resource = new LocalDiagnosisResource();
        setField(resource, "patientServiceBean", new StubPatientServiceBean());
        setField(resource, "karteServiceBean", new StubKarteServiceBean());
        setField(resource, "userServiceBean", new StubUserServiceBean());
        request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("F001:doctor01");
        when(request.getHeader("X-Trace-Id")).thenReturn("trace-100");
    }

    @Test
    void getDiagnosesReturnsLocalSummaryRoutePayload() {
        Map<String, Object> response = resource.getDiagnoses(request, "00001", "2026-03-25", null, false);

        assertEquals("00001", response.get("patientId"));
        assertEquals(1001L, response.get("karteId"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> diseases = (List<Map<String, Object>>) response.get("diseases");
        assertEquals(1, diseases.size());
        assertEquals(55L, diseases.get(0).get("diagnosisId"));
    }

    @Test
    void mutateDiagnosesRejectsMissingKarteId() {
        WebApplicationException exception = assertThrows(WebApplicationException.class, () -> resource.mutateDiagnoses(
                request,
                Map.of(
                        "patientId", "00001",
                        "operations", List.of(Map.of("operation", "delete", "diagnosisId", 55L)))));
        assertEquals(400, exception.getResponse().getStatus());
    }

    @Test
    void mutateDiagnosesRejectsCreateWithoutDiagnosisId() {
        WebApplicationException exception = assertThrows(WebApplicationException.class, () -> resource.mutateDiagnoses(
                request,
                Map.of(
                        "patientId", "00001",
                        "karteId", 1001L,
                        "operations", List.of(Map.of(
                                "operation", "create",
                                "diagnosisName", "感冒",
                                "startDate", "2026-03-25")))));
        assertEquals(400, exception.getResponse().getStatus());
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static final class StubPatientServiceBean extends PatientServiceBean {
        @Override
        public PatientModel getPatientById(String fid, String pid) {
            PatientModel patient = new PatientModel();
            patient.setFacilityId(fid);
            patient.setPatientId(pid);
            patient.setFullName("患者");
            patient.setBirthday(LocalDate.parse("1980-01-01"));
            return patient;
        }
    }

    private static final class StubKarteServiceBean extends KarteServiceBean {
        @Override
        public KarteBean getKarte(String fid, String pid, Date fromDate) {
            KarteBean karte = new KarteBean();
            karte.setId(1001L);
            return karte;
        }

        @Override
        public List<RegisteredDiagnosisModel> getDiagnosis(long karteId, Date fromDate, boolean activeOnly) {
            RegisteredDiagnosisModel model = new RegisteredDiagnosisModel();
            model.setId(55L);
            model.setDiagnosis("感冒");
            model.setDiagnosisCode("A001");
            model.setStarted(new Date());
            return List.of(model);
        }
    }

    private static final class StubUserServiceBean extends UserServiceBean {
        @Override
        public UserModel getUser(String userId) {
            UserModel user = new UserModel();
            user.setUserId(userId);
            return user;
        }
    }
}

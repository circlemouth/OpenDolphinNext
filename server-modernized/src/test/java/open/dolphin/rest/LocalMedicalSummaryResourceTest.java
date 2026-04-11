package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Date;
import java.util.List;
import java.util.Map;
import open.dolphin.encounter.EncounterProjectionRepository;
import open.dolphin.encounter.LocalMedicalSummaryService;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.ProgressCourse;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.rest.dto.localsummary.LocalMedicalSummaryErrorResponse;
import open.dolphin.rest.dto.localsummary.LocalMedicalSummaryResponse;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LocalMedicalSummaryResourceTest {

    private LocalMedicalSummaryResource resource;
    private HttpServletRequest request;
    private StubEncounterProjectionRepository projectionRepository;
    private LocalMedicalSummaryService service;

    @BeforeEach
    void setUp() throws Exception {
        resource = new LocalMedicalSummaryResource();
        projectionRepository = new StubEncounterProjectionRepository();
        service = new LocalMedicalSummaryService();
        setField(resource, "encounterProjectionRepository", projectionRepository);
        setField(resource, "localMedicalSummaryService", service);
        request = mock(HttpServletRequest.class);
        when(request.getRemoteUser()).thenReturn("F001:doctor01");
        when(request.getHeader("X-Request-Id")).thenReturn("req-001");
        when(request.getHeader("X-Trace-Id")).thenReturn("trace-001");
        when(request.getHeader("X-Run-Id")).thenReturn("run-001");
    }

    @Test
    void getMedicalSummaryReturnsSuccessEnvelope() throws Exception {
        configureService(new SuccessPatientServiceBean(), new SuccessKarteServiceBean());

        LocalMedicalSummaryResponse response = resource.getMedicalSummary(request, "F001:E100");

        assertEquals("req-001", response.getRequestId());
        assertEquals("trace-001", response.getTraceId());
        assertEquals("run-001", response.getRunId());
        assertEquals("/api/local/encounters/{encounterKey}/medical-summary", response.getSourcePath());
        assertEquals("SUCCESS", response.getOutcome());
        assertEquals(1, response.getRecordsReturned());
        assertThat(response.getPayload().getOutpatientList()).hasSize(1);
        LocalMedicalSummaryResponse.MedicalSummaryItem item = response.getPayload().getOutpatientList().get(0);
        assertEquals("F001:E100", item.getEncounterKey());
        assertEquals("F001:S100", item.getScheduleKey());
        assertEquals("SUCCESS", item.getOutcome());
        assertEquals("00001", item.getPatient().getPatientId());
        assertEquals("テスト患者", item.getPatient().getWholeName());
        assertThat(item.getSections()).containsKeys("diagnosis", "prescription", "lab", "procedure", "memo");
        assertEquals("SUCCESS", item.getSections().get("diagnosis").getOutcome());
        assertEquals("SUCCESS", item.getSections().get("prescription").getOutcome());
        assertEquals("SUCCESS", item.getSections().get("lab").getOutcome());
        assertEquals("SUCCESS", item.getSections().get("procedure").getOutcome());
        assertEquals("SUCCESS", item.getSections().get("memo").getOutcome());
    }

    @Test
    void getMedicalSummaryReturnsMissingWhenReadModelEmpty() throws Exception {
        configureService(new MissingPatientServiceBean(), new EmptyKarteServiceBean());

        LocalMedicalSummaryResponse response = resource.getMedicalSummary(request, "F001:E100");

        assertEquals("MISSING", response.getOutcome());
        assertEquals(0, response.getRecordsReturned());
        assertThat(response.getPayload().getOutpatientList()).isEmpty();
    }

    @Test
    void getMedicalSummaryReturnsPartialWhenSomeSectionsAreMissing() throws Exception {
        configureService(new SuccessPatientServiceBean(), new PartialKarteServiceBean());

        LocalMedicalSummaryResponse response = resource.getMedicalSummary(request, "F001:E100");

        assertEquals("PARTIAL", response.getOutcome());
        assertEquals(1, response.getRecordsReturned());
        LocalMedicalSummaryResponse.MedicalSummaryItem item = response.getPayload().getOutpatientList().get(0);
        assertEquals("PARTIAL", item.getOutcome());
        assertEquals("SUCCESS", item.getSections().get("diagnosis").getOutcome());
        assertEquals("SUCCESS", item.getSections().get("prescription").getOutcome());
        assertEquals("MISSING", item.getSections().get("lab").getOutcome());
        assertEquals("MISSING", item.getSections().get("procedure").getOutcome());
        assertEquals("MISSING", item.getSections().get("memo").getOutcome());
    }

    @Test
    void getMedicalSummaryRejectsTargetMissingWithNestedErrorEnvelope() throws Exception {
        configureService(new SuccessPatientServiceBean(), new SuccessKarteServiceBean());
        projectionRepository.row = null;

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.getMedicalSummary(request, "F001:E404"));

        assertEquals(404, ex.getResponse().getStatus());
        LocalMedicalSummaryErrorResponse body = (LocalMedicalSummaryErrorResponse) ex.getResponse().getEntity();
        assertEquals("LOCAL_SUMMARY_TARGET_NOT_FOUND", body.getError().getCode());
        assertEquals(404, body.getError().getHttpStatus());
        assertEquals("req-001", body.getError().getRequestId());
        assertEquals("trace-001", body.getError().getTraceId());
        assertEquals("F001:E404", body.getError().getDetails().get("encounterKey"));
    }

    @Test
    void getMedicalSummaryRejectsProjectionConflict() throws Exception {
        configureService(new MismatchPatientServiceBean(), new SuccessKarteServiceBean());

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.getMedicalSummary(request, "F001:E100"));

        assertEquals(409, ex.getResponse().getStatus());
        LocalMedicalSummaryErrorResponse body = (LocalMedicalSummaryErrorResponse) ex.getResponse().getEntity();
        assertEquals("LOCAL_SUMMARY_PROJECTION_CONFLICT", body.getError().getCode());
        assertEquals("ENCOUNTER_SUMMARY_LINK_MISMATCH", body.getError().getDetails().get("trigger"));
    }

    @Test
    void getMedicalSummaryMapsReadModelFailureTo503() throws Exception {
        configureService(new SuccessPatientServiceBean(), new FailingKarteServiceBean());

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> resource.getMedicalSummary(request, "F001:E100"));

        assertEquals(503, ex.getResponse().getStatus());
        LocalMedicalSummaryErrorResponse body = (LocalMedicalSummaryErrorResponse) ex.getResponse().getEntity();
        assertEquals("LOCAL_SUMMARY_READ_MODEL_UNAVAILABLE", body.getError().getCode());
        assertEquals(503, body.getError().getHttpStatus());
    }

    private void configureService(PatientServiceBean patientServiceBean, KarteServiceBean karteServiceBean) throws Exception {
        setField(service, "patientServiceBean", patientServiceBean);
        setField(service, "karteServiceBean", karteServiceBean);
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static EncounterProjectionRepository.EncounterRow encounterRow(String facilityId, String patientId, Long karteId) {
        return new EncounterProjectionRepository.EncounterRow(
                "F001:E100",
                facilityId,
                patientId,
                karteId,
                "F001:S100",
                "E100",
                Instant.parse("2026-03-25T09:00:00Z"),
                "checked_in",
                null,
                null,
                null,
                "owner01",
                "memo",
                "{\"waiting\":true}",
                null,
                1L,
                Instant.parse("2026-03-25T09:00:00Z"));
    }

    private static DocumentModel buildDocument(long id, LocalDate date, String entity, Object model) {
        ModuleInfoBean info = new ModuleInfoBean();
        info.setEntity(entity);
        ModuleModel module = new ModuleModel();
        module.setModuleInfoBean(info);
        module.setBeanJson(open.dolphin.infomodel.ModelUtils.jsonEncode(model));

        DocumentModel document = new DocumentModel();
        document.setId(id);
        document.setStarted(Date.from(date.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant()));
        document.setModules(List.of(module));
        return document;
    }

    private static BundleDolphin buildBundle(String name) {
        BundleDolphin bundle = new BundleDolphin();
        ClaimItem item = new ClaimItem();
        item.setName(name);
        item.setNumber("1");
        item.setUnit("回");
        bundle.setClaimItem(new ClaimItem[]{item});
        return bundle;
    }

    private static ProgressCourse buildMemo(String text) {
        ProgressCourse progress = new ProgressCourse();
        progress.setFreeText(text);
        return progress;
    }

    private final class StubEncounterProjectionRepository extends EncounterProjectionRepository {
        private EncounterProjectionRepository.EncounterRow row = encounterRow("F001", "00001", 1001L);

        @Override
        public EncounterRow findByEncounterKey(String encounterKey) {
            return row;
        }
    }

    private static final class SuccessPatientServiceBean extends PatientServiceBean {
        @Override
        public PatientModel getPatientById(String fid, String pid) {
            PatientModel patient = new PatientModel();
            patient.setFacilityId(fid);
            patient.setPatientId(pid);
            patient.setFullName("テスト患者");
            return patient;
        }
    }

    private static final class MissingPatientServiceBean extends PatientServiceBean {
        @Override
        public PatientModel getPatientById(String fid, String pid) {
            return null;
        }
    }

    private static final class MismatchPatientServiceBean extends PatientServiceBean {
        @Override
        public PatientModel getPatientById(String fid, String pid) {
            PatientModel patient = new PatientModel();
            patient.setFacilityId("F999");
            patient.setPatientId("00001");
            patient.setFullName("別患者");
            return patient;
        }
    }

    private static class SuccessKarteServiceBean extends KarteServiceBean {
        @Override
        public List<open.dolphin.infomodel.DocInfoModel> getDocumentList(long karteId, Date fromDate, boolean includeModifid) {
            open.dolphin.infomodel.DocInfoModel diagnosis = new open.dolphin.infomodel.DocInfoModel();
            diagnosis.setDocPk(1L);
            open.dolphin.infomodel.DocInfoModel prescription = new open.dolphin.infomodel.DocInfoModel();
            prescription.setDocPk(2L);
            open.dolphin.infomodel.DocInfoModel lab = new open.dolphin.infomodel.DocInfoModel();
            lab.setDocPk(3L);
            open.dolphin.infomodel.DocInfoModel procedure = new open.dolphin.infomodel.DocInfoModel();
            procedure.setDocPk(4L);
            open.dolphin.infomodel.DocInfoModel memo = new open.dolphin.infomodel.DocInfoModel();
            memo.setDocPk(5L);
            return List.of(diagnosis, prescription, lab, procedure, memo);
        }

        @Override
        public List<DocumentModel> getDocumentsWithModules(List<Long> ids) {
            LocalDate date = LocalDate.parse("2026-03-25");
            return List.of(
                    buildDocument(1L, date, IInfoModel.ENTITY_TEXT, buildMemo("診療メモ")),
                    buildDocument(2L, date, IInfoModel.ENTITY_MED_ORDER, buildBundle("アムロジピン")),
                    buildDocument(3L, date, IInfoModel.ENTITY_LABO_TEST, buildBundle("血液検査")),
                    buildDocument(4L, date, IInfoModel.ENTITY_TREATMENT, buildBundle("処置")),
                    buildDocument(5L, date, IInfoModel.ENTITY_GENERAL_ORDER, buildBundle("一般処置")));
        }

        @Override
        public List<RegisteredDiagnosisModel> getDiagnosis(long karteId, Date fromDate, boolean activeOnly) {
            RegisteredDiagnosisModel diagnosis = new RegisteredDiagnosisModel();
            diagnosis.setDiagnosis("高血圧症");
            diagnosis.setDiagnosisCode("I10");
            diagnosis.setStartDate("2026-03-01");
            return List.of(diagnosis);
        }
    }

    private static final class PartialKarteServiceBean extends SuccessKarteServiceBean {
        @Override
        public List<open.dolphin.infomodel.DocInfoModel> getDocumentList(long karteId, Date fromDate, boolean includeModifid) {
            open.dolphin.infomodel.DocInfoModel diagnosis = new open.dolphin.infomodel.DocInfoModel();
            diagnosis.setDocPk(1L);
            open.dolphin.infomodel.DocInfoModel prescription = new open.dolphin.infomodel.DocInfoModel();
            prescription.setDocPk(2L);
            return List.of(diagnosis, prescription);
        }

        @Override
        public List<DocumentModel> getDocumentsWithModules(List<Long> ids) {
            LocalDate date = LocalDate.parse("2026-03-25");
            return List.of(
                    buildDocument(2L, date, IInfoModel.ENTITY_MED_ORDER, buildBundle("アムロジピン")));
        }
    }

    private static final class EmptyKarteServiceBean extends KarteServiceBean {
        @Override
        public List<open.dolphin.infomodel.DocInfoModel> getDocumentList(long karteId, Date fromDate, boolean includeModifid) {
            return List.of();
        }

        @Override
        public List<RegisteredDiagnosisModel> getDiagnosis(long karteId, Date fromDate, boolean activeOnly) {
            return List.of();
        }
    }

    private static final class FailingKarteServiceBean extends KarteServiceBean {
        @Override
        public List<open.dolphin.infomodel.DocInfoModel> getDocumentList(long karteId, Date fromDate, boolean includeModifid) {
            throw new IllegalStateException("read model unavailable");
        }
    }
}

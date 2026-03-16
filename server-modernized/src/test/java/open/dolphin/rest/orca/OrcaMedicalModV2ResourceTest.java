package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.infomodel.ProgressCourse;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.rest.dto.outpatient.MedicalOutpatientResponse;
import open.dolphin.rest.dto.outpatient.OutpatientFlagResponse;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.PVTServiceBean;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Contract tests for {@link OrcaMedicalModV2Resource}.
 */
class OrcaMedicalModV2ResourceTest extends RuntimeDelegateTestSupport {

    private OrcaMedicalModV2Resource resource;
    private RecordingSessionAuditDispatcher auditDispatcher;
    private HttpServletRequest servletRequest;

    @BeforeEach
    void setUp() throws Exception {
        resource = new OrcaMedicalModV2Resource();
        auditDispatcher = new RecordingSessionAuditDispatcher();
        injectField(resource, "sessionAuditDispatcher", auditDispatcher);
        injectField(resource, "pvtServiceBean", new FakePVTServiceBean());
        injectField(resource, "karteServiceBean", new FakeKarteServiceBean());
        injectField(resource, "patientServiceBean", new FakePatientServiceBean());

        servletRequest = (HttpServletRequest)
                Proxy.newProxyInstance(getClass().getClassLoader(), new Class[]{HttpServletRequest.class}, (proxy, method, args) -> {
                    String name = method.getName();
                    if ("getRemoteUser".equals(name)) {
                        return "F001:doctor01";
                    }
                    if ("getRemoteAddr".equals(name)) {
                        return "127.0.0.1";
                    }
                    if ("getRequestURI".equals(name)) {
                        return "/api/orca/medicalmodv2/outpatient";
                    }
                    if ("getHeader".equals(name) && args != null && args.length == 1) {
                        String header = String.valueOf(args[0]);
                        return switch (header) {
                            case "X-Request-Id" -> "req-outpatient-medical";
                            case "X-Trace-Id" -> "trace-outpatient-medical";
                            case "X-Run-Id" -> "20251225T040041Z";
                            case "User-Agent" -> "JUnit";
                            default -> null;
                        };
                    }
                    return null;
                });
    }

    @Test
    void postOutpatientMedical_returnsTelemetryAndAudit() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("Patient_ID", "00001");

        MedicalOutpatientResponse response = resource.postOutpatientMedical(servletRequest, payload);

        assertNotNull(response);
        assertEquals("20251225T040041Z", response.getRunId());
        assertFalse(response.isCacheHit());
        assertFalse(response.isMissingMaster());
        assertEquals(1, response.getRecordsReturned());
        assertEquals("server", response.getDataSourceTransition());

        OutpatientFlagResponse.AuditEvent auditEvent = response.getAuditEvent();
        assertNotNull(auditEvent, "Audit event should be present");
        assertEquals("ORCA_MEDICAL_GET", auditEvent.getAction());
        assertEquals("/api/orca/medicalmodv2/outpatient", auditEvent.getResource());
        assertEquals("SUCCESS", auditEvent.getOutcome());
        assertEquals("trace-outpatient-medical", auditEvent.getTraceId());
        assertEquals("req-outpatient-medical", auditEvent.getRequestId());

        Map<String, Object> details = auditEvent.getDetails();
        assertEquals("F001", details.get("facilityId"));
        assertEquals(1, details.get("recordsReturned"));
        assertEquals("charts_orchestration", details.get("telemetryFunnelStage"));
        assertEquals("SUCCESS", details.get("outcome"));

        assertNotNull(auditDispatcher.payload, "Audit dispatcher should receive payload");
        assertEquals("ORCA_MEDICAL_GET", auditDispatcher.payload.getAction());
        assertEquals("/api/orca/medicalmodv2/outpatient", auditDispatcher.payload.getResource());
        assertEquals("F001:doctor01", auditDispatcher.payload.getActorId());
        assertEquals("trace-outpatient-medical", auditDispatcher.payload.getTraceId());
        assertEquals("req-outpatient-medical", auditDispatcher.payload.getRequestId());
        assertEquals(AuditEventEnvelope.Outcome.SUCCESS, auditDispatcher.outcome);
    }

    @Test
    void postOutpatientMedical_doesNotMixTodayDataWhenPastDateRequested() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("Patient_ID", "00001");
        payload.put("date", "2020-01-01");

        MedicalOutpatientResponse response = resource.postOutpatientMedical(servletRequest, payload);

        assertNotNull(response);
        assertEquals(1, response.getRecordsReturned());
        assertNotNull(response.getOutpatientList());
        assertEquals(1, response.getOutpatientList().size());
        MedicalOutpatientResponse.MedicalOutpatientEntry entry = response.getOutpatientList().get(0);
        assertEquals("MISSING", entry.getOutcome());
        assertNull(entry.getRecordsReturned());
        assertEquals(0, entry.getSections().get("diagnosis").getRecordsReturned());
        assertEquals(0, entry.getSections().get("prescription").getRecordsReturned());
        assertEquals(0, entry.getSections().get("memo").getRecordsReturned());
    }

    @Test
    void postOutpatientMedical_readsJsonOnlyModules() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("Patient_ID", "00001");

        MedicalOutpatientResponse response = resource.postOutpatientMedical(servletRequest, payload);

        assertNotNull(response);
        MedicalOutpatientResponse.MedicalOutpatientEntry entry = response.getOutpatientList().get(0);
        assertEquals(1, entry.getSections().get("prescription").getRecordsReturned());
        assertEquals(1, entry.getSections().get("memo").getRecordsReturned());
    }

    private static void injectField(Object target, String fieldName, Object value) throws Exception {
        Class<?> type = target.getClass();
        Field field = null;
        while (type != null && field == null) {
            try {
                field = type.getDeclaredField(fieldName);
            } catch (NoSuchFieldException ignored) {
                type = type.getSuperclass();
            }
        }
        if (field == null) {
            throw new NoSuchFieldException(fieldName);
        }
        field.setAccessible(true);
        field.set(target, value);
    }

    private static final class RecordingSessionAuditDispatcher extends SessionAuditDispatcher {
        private AuditEventPayload payload;
        private AuditEventEnvelope.Outcome outcome;

        @Override
        public AuditEventEnvelope record(AuditEventPayload payload, AuditEventEnvelope.Outcome overrideOutcome,
                String errorCode, String errorMessage) {
            this.payload = payload;
            this.outcome = overrideOutcome;
            return null;
        }
    }

    private static final class FakePVTServiceBean extends PVTServiceBean {
        @Override
        public List<PatientVisitModel> getPvt(
                String fid, String date, int firstResult, int maxResult, String appoDateFrom, String appoDateTo) {
            PatientModel patient = new PatientModel();
            patient.setPatientId("00001");
            patient.setFullName("テスト患者");
            patient.setKanaName("テスト");
            patient.setBirthday(LocalDate.parse("1990-01-01"));
            patient.setGender("F");

            PatientVisitModel visit = new PatientVisitModel();
            visit.setId(201L);
            visit.setFacilityId(fid);
            visit.setPatientModel(patient);
            visit.setPvtDate(LocalDateTime.parse(date + "T10:00:00"));
            visit.setDeptName("内科");
            visit.setDoctorName("山田医師");
            return List.of(visit);
        }
    }

    private static final class FakeKarteServiceBean extends KarteServiceBean {
        @Override
        public KarteBean getKarte(String facilityId, String patientId, Date fromDate) {
            KarteBean karte = new KarteBean();
            karte.setId(20L);
            return karte;
        }

        @Override
        public List<DocInfoModel> getDocumentList(long karteId, Date fromDate, boolean includeModifid) {
            DocInfoModel info = new DocInfoModel();
            info.setDocPk(2L);
            info.setConfirmDate(new Date());
            return List.of(info);
        }

        @Override
        public List<DocumentModel> getDocuments(List<Long> ids) {
            BundleDolphin bundle = new BundleDolphin();
            bundle.setBundleNumber("1");
            bundle.setClassCode("210");
            ClaimItem item = new ClaimItem();
            item.setName("アムロジピン錠");
            item.setNumber("1");
            item.setUnit("錠");
            bundle.setClaimItem(new ClaimItem[]{item});

            ModuleInfoBean bundleInfo = new ModuleInfoBean();
            bundleInfo.setEntity(IInfoModel.ENTITY_MED_ORDER);
            ModuleModel bundleModule = new ModuleModel();
            bundleModule.setModuleInfoBean(bundleInfo);
            bundleModule.setBeanJson(ModelUtils.jsonEncode(bundle));

            ProgressCourse progress = new ProgressCourse();
            progress.setFreeText("経過良好");
            ModuleInfoBean memoInfo = new ModuleInfoBean();
            memoInfo.setEntity(IInfoModel.ENTITY_TEXT);
            ModuleModel memoModule = new ModuleModel();
            memoModule.setModuleInfoBean(memoInfo);
            memoModule.setBeanJson(ModelUtils.jsonEncode(progress));

            DocumentModel document = new DocumentModel();
            document.setStarted(new Date());
            document.setModules(List.of(bundleModule, memoModule));
            return List.of(document);
        }

        @Override
        public List<DocumentModel> getDocumentsWithModules(List<Long> ids) {
            return getDocuments(ids);
        }

        @Override
        public List<RegisteredDiagnosisModel> getDiagnosis(long karteId, Date fromDate, boolean activeOnly) {
            RegisteredDiagnosisModel diagnosis = new RegisteredDiagnosisModel();
            diagnosis.setDiagnosis("高血圧症");
            diagnosis.setDiagnosisCode("I10");
            diagnosis.setStartDate("2025-12-01");
            return List.of(diagnosis);
        }
    }

    private static final class FakePatientServiceBean extends PatientServiceBean {
        @Override
        public PatientModel getPatientById(String fid, String pid) {
            PatientModel patient = new PatientModel();
            patient.setPatientId(pid);
            patient.setFullName("テスト患者");
            patient.setKanaName("テスト");
            patient.setBirthday(LocalDate.parse("1990-01-01"));
            patient.setGender("F");
            return patient;
        }
    }
}
